import { asc, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas } from "@/db/schema";
import { toFtsPrefixQuery } from "./shared";

export type Area = typeof areas.$inferSelect;

export async function getArea(db: Database, id: number): Promise<Area | undefined> {
  return db.select().from(areas).where(eq(areas.id, id)).get();
}

/** The area a subarea-scoped climb list should actually query: the given
 * sub-area when it's a real, indexed descendant of `area`, otherwise
 * `area` itself. Guards both a forged/stale id from the URL and the
 * lft=rght=0 placeholder of a not-yet-reindexed area (whose "range" would
 * match every unindexed climb). */
export async function resolveSubareaScope(
  db: Database,
  area: Area,
  subareaId: number | null,
): Promise<Area> {
  if (subareaId == null || subareaId === area.id) return area;
  const sub = await getArea(db, subareaId);
  if (!sub) return area;
  if (sub.lft === 0 && sub.rght === 0) return area;
  if (!(sub.lft > area.lft && sub.rght < area.rght)) return area;
  return sub;
}

export async function getSubareas(db: Database, areaId: number): Promise<Area[]> {
  return db
    .select()
    .from(areas)
    .where(eq(areas.parentId, areaId))
    .orderBy(asc(areas.lft));
}

/** Root-first, immediate-parent-last. Does not include `area` itself.
 *
 * Walks `parentId` via a recursive CTE rather than the lft/rght nested-set
 * range — unlike subtree/descendant enumeration (getSubtreeClimbs,
 * areaNameCondition), which is what lft/rght actually exists to make cheap
 * for a potentially huge subtree, an ancestor chain is bounded by tree depth
 * (a handful of levels) regardless of subtree size, so there's no
 * performance reason to depend on it here. The upside: this is correct
 * immediately for a freshly created area, with zero dependency on the async
 * lft/rght recompute (see db/reindex-areas.ts) — parentId is written
 * synchronously at insert time and never needs fixing up. */
export async function getAncestors(db: Database, area: Area): Promise<Area[]> {
  if (area.parentId == null) return [];

  return db.all<Area>(sql`
    WITH RECURSIVE ancestors(id, depth) AS (
      SELECT id, 0 FROM areas WHERE id = ${area.parentId}
      UNION ALL
      SELECT areas.parent_id, ancestors.depth + 1
      FROM ancestors
      JOIN areas ON areas.id = ancestors.id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT areas.* FROM areas
    JOIN ancestors ON areas.id = ancestors.id
    ORDER BY ancestors.depth DESC
  `);
}

/** The `depth` ancestors closest to `area` (root-first among themselves), for
 * a short breadcrumb rather than the full ancestor chain. */
export async function getNearestAncestors(
  db: Database,
  area: Area,
  depth: number,
): Promise<Area[]> {
  const ancestors = await getAncestors(db, area);
  return ancestors.slice(-depth);
}

/** SQL condition for "this row's area equals or descends from an area whose
 * name matches (FTS prefix match)" — shared by any query that scopes rows
 * to an area name or its subtree (climb search, a user's send history).
 * Expressed as a single correlated EXISTS subquery, not one bind parameter
 * per matched area: an area name can match hundreds of areas (a common
 * word, a broad region), and one `(lft >= ? AND rght <= ?)` clause per match
 * blows past SQLite's bound-parameter limit — this is O(1) parameters no
 * matter how many areas match. Callers must have their row's own area
 * joined in as `areas` (the same alias `searchClimbs`/`getSendsForUserPage`
 * already use) for the correlation to resolve. Returns `null` when there's
 * no name to filter by (filter inactive); `sql\`0\`` when the name has no
 * matchable tokens (matches nothing) — the caller can just always push a
 * non-null result onto its condition list. */
export function areaNameCondition(areaName: string | undefined): SQL | null {
  if (!areaName) return null;
  const query = toFtsPrefixQuery(areaName);
  if (!query) return sql`0`;

  return sql`EXISTS (
    SELECT 1 FROM areas matched_area
    JOIN areas_fts ON areas_fts.rowid = matched_area.id
    WHERE areas_fts MATCH ${query}
    AND matched_area.lft <= areas.lft AND matched_area.rght >= areas.rght
  )`;
}

export type AreaBreadcrumbs = Record<number, { id: number; name: string }[]>;

type BreadcrumbRow = {
  targetId: number;
  ancestorId: number | null;
  ancestorName: string | null;
};

/** Up to `depth` ancestors for each of `areaIds`, keyed by area id — one
 * query for the whole batch, not one round trip per distinct area.
 *
 * Walks `parentId` (see getAncestors's doc comment for why — ancestor
 * chains don't need the nested-set range the way subtree queries do) via a
 * recursive CTE, capped at `depth` levels per target, batched across every
 * requested id in one query. A LEFT JOIN back to the target-id list keeps
 * one row per target even when it has zero (nearby) ancestors, which is
 * what lets an existing root-level area come back as `[]` rather than
 * being silently omitted like a nonexistent id is. */
export async function getAreaBreadcrumbs(
  db: Database,
  areaIds: number[],
  depth = 2,
): Promise<AreaBreadcrumbs> {
  const ids = [...new Set(areaIds)];
  if (ids.length === 0) return {};

  const rows = await db.all<BreadcrumbRow>(sql`
    WITH RECURSIVE chain(target_id, ancestor_id, dist) AS (
      SELECT id, parent_id, 1 FROM areas
      WHERE id IN (${sql.join(ids, sql`, `)}) AND parent_id IS NOT NULL
      UNION ALL
      SELECT chain.target_id, areas.parent_id, chain.dist + 1
      FROM chain
      JOIN areas ON areas.id = chain.ancestor_id
      WHERE areas.parent_id IS NOT NULL AND chain.dist < ${depth}
    )
    SELECT target.id AS targetId, ancestor.id AS ancestorId, ancestor.name AS ancestorName
    FROM (SELECT id FROM areas WHERE id IN (${sql.join(ids, sql`, `)})) target
    LEFT JOIN chain ON chain.target_id = target.id
    LEFT JOIN areas ancestor ON ancestor.id = chain.ancestor_id
    ORDER BY target.id ASC, chain.dist DESC
  `);

  const breadcrumbs: AreaBreadcrumbs = {};
  for (const row of rows) {
    if (!(row.targetId in breadcrumbs)) breadcrumbs[row.targetId] = [];
    if (row.ancestorId != null && row.ancestorName != null) {
      breadcrumbs[row.targetId].push({ id: row.ancestorId, name: row.ancestorName });
    }
  }
  return breadcrumbs;
}

export type AreaWithAncestorPath = Area & { ancestorPath: string | null };

/** Same page size as climb search (see SEARCH_PAGE_SIZE in climbs.ts) — kept
 * as its own constant here to avoid a circular import between the two query
 * modules. */
export const AREA_SEARCH_PAGE_SIZE = 25;

export type SearchAreasPage = { areas: AreaWithAncestorPath[]; hasNextPage: boolean };

/** `ancestorPath` reads immediate-parent-first, e.g. "Squamish > British Columbia > Canada".
 *
 * Walks `parentId` (see getAncestors's doc comment) rather than lft/rght, so
 * a freshly created area's ancestor path is correct immediately, with no
 * dependency on the async lft/rght recompute.
 *
 * Ordered by FTS rank with `areas.id` as the deterministic tie-breaker —
 * near-identical names share a bm25 score, and without a unique final key
 * OFFSET pagination can duplicate or skip rows across pages. */
export async function searchAreas(
  db: Database,
  name: string,
  page = 1,
): Promise<SearchAreasPage> {
  const query = toFtsPrefixQuery(name);
  if (!query) return { areas: [], hasNextPage: false };

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<AreaWithAncestorPath>(sql`
    WITH RECURSIVE ancestor_chain(area_id, ancestor_id, dist) AS (
      SELECT id, parent_id, 1 FROM areas WHERE parent_id IS NOT NULL
      UNION ALL
      SELECT ancestor_chain.area_id, areas.parent_id, ancestor_chain.dist + 1
      FROM ancestor_chain
      JOIN areas ON areas.id = ancestor_chain.ancestor_id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT areas.*, (
      SELECT GROUP_CONCAT(ancestor.name, ' > ')
      FROM ancestor_chain
      JOIN areas ancestor ON ancestor.id = ancestor_chain.ancestor_id
      WHERE ancestor_chain.area_id = areas.id
      ORDER BY ancestor_chain.dist ASC
    ) AS ancestorPath
    FROM areas
    JOIN areas_fts ON areas_fts.rowid = areas.id
    WHERE areas_fts MATCH ${query}
    ORDER BY rank, areas.id
    LIMIT ${AREA_SEARCH_PAGE_SIZE + 1}
    OFFSET ${(page - 1) * AREA_SEARCH_PAGE_SIZE}
  `);

  return {
    areas: rows.slice(0, AREA_SEARCH_PAGE_SIZE),
    hasNextPage: rows.length > AREA_SEARCH_PAGE_SIZE,
  };
}

/** Exact match count for the same FTS predicate as `searchAreas` — a plain
 * aggregate over the FTS match, no ancestor-path CTE, so it's cheaper than
 * the page query it accompanies. */
export async function countSearchAreas(db: Database, name: string): Promise<number> {
  const query = toFtsPrefixQuery(name);
  if (!query) return 0;

  const [row] = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM areas_fts
    WHERE areas_fts MATCH ${query}
  `);
  return row?.count ?? 0;
}
