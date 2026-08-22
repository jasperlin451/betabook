import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
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
