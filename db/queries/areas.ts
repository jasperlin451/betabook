import { eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas } from "@/db/schema";
import { toFtsPrefixQuery } from "./shared";
import { AREA_SEARCH_PAGE_SIZE } from "@/lib/page-sizes";

export type Area = typeof areas.$inferSelect;

export async function getArea(db: Database, id: number): Promise<Area | undefined> {
  return db.select().from(areas).where(eq(areas.id, id)).get();
}

/** The area a subarea-scoped climb list should actually query: the given
 * sub-area when it really descends from `area`, otherwise `area` itself —
 * guarding a forged or stale id from the URL, which would otherwise scope
 * the list to an area the page isn't showing.
 *
 * Walks `parentId` upward from the candidate rather than testing a stored
 * range: an ancestor chain is bounded by tree depth (a handful of levels),
 * so this stays a few index seeks no matter how large either subtree is. */
export async function resolveSubareaScope(
  db: Database,
  area: Area,
  subareaId: number | null,
): Promise<Area> {
  if (subareaId == null || subareaId === area.id) return area;
  const sub = await getArea(db, subareaId);
  if (!sub) return area;

  const [row] = await db.all<{ found: number }>(sql`
    WITH RECURSIVE chain(id) AS (
      SELECT parent_id FROM areas WHERE id = ${sub.id}
      UNION ALL
      SELECT areas.parent_id FROM chain
      JOIN areas ON areas.id = chain.id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT 1 AS found FROM chain WHERE id = ${area.id} LIMIT 1
  `);
  return row ? sub : area;
}

/** Direct children, name-sorted.
 *
 * Sorted in JS with localeCompare rather than by SQL ORDER BY, because
 * neither collation SQLite offers gets this right for a worldwide area list.
 * BINARY drops every lowercase-initial name below every uppercase one, and
 * NOCASE only case-folds ASCII A-Z — so it sorts every accented name after
 * `Z`, burying "Çitdibi" under Antalya and "Črni kal" under Slovenia at the
 * bottom of their sibling lists. Measured against the previous ordering,
 * NOCASE moved 2,623 of 10,230 areas and BINARY moved 3,436; localeCompare
 * moves none, because it is what computeAreaBounds used to bake into
 * areas.lft. D1 has no ICU collation to reach for instead.
 *
 * Affordable because this is one area's direct children — 1,749 at the very
 * widest, typically under a hundred — fetched through areas_parent_idx.
 *
 * Sorting at read time rather than reading a stored position also means a
 * rename takes effect immediately; lft only moved when a full tree recompute
 * ran, which updateArea never triggered. */
export async function getSubareas(db: Database, areaId: number): Promise<Area[]> {
  const rows = await db.select().from(areas).where(eq(areas.parentId, areaId));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Root-first, immediate-parent-last. Does not include `area` itself.
 *
 * Walks `parentId` upward via a recursive CTE. Unlike subtree/descendant
 * enumeration (getSubtreeClimbs, areaNameCondition), which can fan out over
 * tens of thousands of areas, an ancestor chain is bounded by tree depth (a
 * handful of levels) regardless of subtree size, so the walk stays cheap
 * without any index beyond the areas primary key. */
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
    SELECT areas.id AS id, areas.parent_id AS parentId, areas.name AS name,
           areas.description AS description
    FROM areas
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
 *
 * Built as a single non-correlated `IN` set, deliberately: the previous
 * correlated `EXISTS` re-ran the containment test once per candidate row, so
 * its cost was O(rows x matched_areas) and a broad name blew up — measured at
 * 11.6s for a name matching 779 areas (0.4s fixed + ~14ms per matched area),
 * against D1's 30-second statement cap. Evaluating the descendant set once
 * instead is ~13ms for the same query and the same results.
 *
 * Still O(1) bound parameters no matter how many areas match — an area name
 * can match hundreds (a common word, a broad region), and one clause per
 * match would blow past SQLite's bound-parameter limit.
 *
 * Callers must
 * have their row's own area joined in as `areas` — the same alias
 * `searchClimbs`/`getSendsForUserPage` already use. Returns `null` when
 * there's no name to filter by (filter inactive); `sql\`0\`` when the name
 * has no matchable tokens (matches nothing) — the caller can just always
 * push a non-null result onto its condition list. */
export function areaNameCondition(areaName: string | undefined): SQL | null {
  if (!areaName) return null;
  const query = toFtsPrefixQuery(areaName);
  if (!query) return sql`0`;

  // UNION, not UNION ALL: when one matched area nests inside another, the
  // same descendant is reachable by more than one path.
  return sql`areas.id IN (
    WITH RECURSIVE matched(id) AS (
      SELECT matched_area.id FROM areas matched_area
      JOIN areas_fts ON areas_fts.rowid = matched_area.id
      WHERE areas_fts MATCH ${query}
      UNION
      SELECT child.id FROM areas child JOIN matched ON child.parent_id = matched.id
    )
    SELECT id FROM matched
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
 * Walks `parentId` via a recursive CTE (see getAncestors's doc comment),
 * capped at `depth` levels per target, batched across every requested id in
 * one query. A LEFT JOIN back to the target-id list keeps
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

  // D1 permits at most 100 bound parameters per statement. Passing the ids
  // as one JSON value keeps this query at two bindings (ids + depth), even
  // for the 200-row send-export batches that consume it. Binding each id in
  // both the seed and target lists used to fail at only 50 distinct areas.
  const rows = await db.all<BreadcrumbRow>(sql`
    WITH RECURSIVE requested(id) AS (
      SELECT CAST(value AS INTEGER) FROM json_each(${JSON.stringify(ids)})
    ), chain(target_id, ancestor_id, dist) AS (
      SELECT areas.id, areas.parent_id, 1 FROM requested
      JOIN areas ON areas.id = requested.id
      WHERE areas.parent_id IS NOT NULL
      UNION ALL
      SELECT chain.target_id, areas.parent_id, chain.dist + 1
      FROM chain
      JOIN areas ON areas.id = chain.ancestor_id
      WHERE areas.parent_id IS NOT NULL AND chain.dist < ${depth}
    )
    SELECT target.id AS targetId, ancestor.id AS ancestorId, ancestor.name AS ancestorName
    FROM requested
    JOIN areas target ON target.id = requested.id
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
export { AREA_SEARCH_PAGE_SIZE };

export type SearchAreasPage = { areas: AreaWithAncestorPath[]; hasNextPage: boolean };

/** `ancestorPath` reads root-first, e.g. "Canada > British Columbia > Squamish"
 * — the same outside-in reading as `AreaBreadcrumb`, so a suggestion row and
 * a result row place a crag identically. Ordering is pinned by the subquery
 * the concat reads from; see the note in the SQL.
 *
 * Walks `parentId` via a recursive CTE (see getAncestors's doc comment)
 * rather than a stored position, so a freshly created area's ancestor path
 * is correct immediately.
 *
 * Ordered by FTS rank with `areas.id` as the deterministic tie-breaker —
 * near-identical names share a bm25 score, and without a unique final key
 * OFFSET pagination can duplicate or skip rows across pages. */
export async function searchAreas(
  db: Database,
  name: string,
  page = 1,
  pageSize = AREA_SEARCH_PAGE_SIZE,
): Promise<SearchAreasPage> {
  const query = toFtsPrefixQuery(name);
  if (!query) return { areas: [], hasNextPage: false };

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<AreaWithAncestorPath>(sql`
    WITH RECURSIVE matched(area_id, score) AS (
      SELECT areas.id, bm25(areas_fts)
      FROM areas
      JOIN areas_fts ON areas_fts.rowid = areas.id
      WHERE areas_fts MATCH ${query}
      ORDER BY bm25(areas_fts), areas.id
      LIMIT ${pageSize + 1}
      OFFSET ${(page - 1) * pageSize}
    ), ancestor_chain(area_id, ancestor_id, dist) AS (
      SELECT matched.area_id, areas.parent_id, 1
      FROM matched
      JOIN areas ON areas.id = matched.area_id
      WHERE areas.parent_id IS NOT NULL
      UNION ALL
      SELECT ancestor_chain.area_id, areas.parent_id, ancestor_chain.dist + 1
      FROM ancestor_chain
      JOIN areas ON areas.id = ancestor_chain.ancestor_id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT areas.id AS id, areas.parent_id AS parentId, areas.name AS name,
           areas.description AS description, (
      -- GROUP_CONCAT joins rows in the order it receives them, so the
      -- ORDER BY belongs on a subquery it consumes. Placed beside the
      -- aggregate it would order that query's single output row instead,
      -- leaving the concatenation to follow incidental scan order.
      SELECT GROUP_CONCAT(name, ' > ') FROM (
        SELECT ancestor.name AS name
        FROM ancestor_chain
        JOIN areas ancestor ON ancestor.id = ancestor_chain.ancestor_id
        WHERE ancestor_chain.area_id = areas.id
        ORDER BY ancestor_chain.dist DESC
      )
    ) AS ancestorPath
    FROM matched
    JOIN areas ON areas.id = matched.area_id
    ORDER BY matched.score, areas.id
  `);

  return {
    areas: rows.slice(0, pageSize),
    hasNextPage: rows.length > pageSize,
  };
}

/** Exact match count for the same FTS predicate as `searchAreas` — no
 * ancestor-path CTE, so it's cheaper than the page query it accompanies.
 * Keeps `searchAreas`'s join to `areas` (a PK seek per match) rather than
 * counting FTS rows alone, so the two can never disagree about what a match
 * is and caption a list with a number it cannot reach. */
export async function countSearchAreas(db: Database, name: string): Promise<number> {
  const query = toFtsPrefixQuery(name);
  if (!query) return 0;

  const [row] = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM areas
    JOIN areas_fts ON areas_fts.rowid = areas.id
    WHERE areas_fts MATCH ${query}
  `);
  return row?.count ?? 0;
}
