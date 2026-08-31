import { eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas } from "@/db/schema";
import { toFtsPrefixQuery } from "./shared";

export type Area = typeof areas.$inferSelect;

export async function getArea(db: Database, id: number): Promise<Area | undefined> {
  return db.select().from(areas).where(eq(areas.id, id)).get();
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

/** `ancestorPath` reads immediate-parent-first, e.g. "Squamish > British Columbia > Canada".
 *
 * Walks `parentId` via a recursive CTE (see getAncestors's doc comment). */
export async function searchAreas(
  db: Database,
  name: string,
): Promise<AreaWithAncestorPath[]> {
  const query = toFtsPrefixQuery(name);
  if (!query) return [];

  return db.all<AreaWithAncestorPath>(sql`
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
    ORDER BY rank
    LIMIT 25
  `);
}
