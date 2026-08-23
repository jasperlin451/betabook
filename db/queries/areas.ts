import { and, asc, eq, gt, lt, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas } from "@/db/schema";
import { toFtsPrefixQuery } from "./shared";

export type Area = typeof areas.$inferSelect;

export async function getArea(db: Database, id: number): Promise<Area | undefined> {
  return db.select().from(areas).where(eq(areas.id, id)).get();
}

export async function getSubareas(db: Database, areaId: number): Promise<Area[]> {
  return db
    .select()
    .from(areas)
    .where(eq(areas.parentId, areaId))
    .orderBy(asc(areas.lft));
}

/** Root-first, immediate-parent-last. Does not include `area` itself. */
export async function getAncestors(db: Database, area: Area): Promise<Area[]> {
  return db
    .select()
    .from(areas)
    .where(and(lt(areas.lft, area.lft), gt(areas.rght, area.rght)))
    .orderBy(asc(areas.lft));
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

/** Up to `depth` ancestors for each of `areaIds`, keyed by area id — one
 * lookup per distinct area, not per caller-side row. */
export async function getAreaBreadcrumbs(
  db: Database,
  areaIds: number[],
  depth = 2,
): Promise<AreaBreadcrumbs> {
  const breadcrumbs: AreaBreadcrumbs = {};
  await Promise.all(
    [...new Set(areaIds)].map(async (areaId) => {
      const area = await getArea(db, areaId);
      if (!area) return;
      const ancestors = await getNearestAncestors(db, area, depth);
      breadcrumbs[areaId] = ancestors.map((a) => ({ id: a.id, name: a.name }));
    }),
  );
  return breadcrumbs;
}

export type AreaWithAncestorPath = Area & { ancestorPath: string | null };

/** `ancestorPath` reads immediate-parent-first, e.g. "Squamish > British Columbia > Canada". */
export async function searchAreas(
  db: Database,
  name: string,
): Promise<AreaWithAncestorPath[]> {
  const query = toFtsPrefixQuery(name);
  if (!query) return [];

  return db.all<AreaWithAncestorPath>(sql`
    SELECT areas.*, (
      SELECT GROUP_CONCAT(ancestor.name, ' > ') FROM (
        SELECT name FROM areas ancestor
        WHERE ancestor.lft < areas.lft AND ancestor.rght > areas.rght
        ORDER BY ancestor.lft DESC
      ) ancestor
    ) AS ancestorPath
    FROM areas
    JOIN areas_fts ON areas_fts.rowid = areas.id
    WHERE areas_fts MATCH ${query}
    ORDER BY rank
    LIMIT 25
  `);
}
