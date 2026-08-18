import { and, asc, eq, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "./client";
import { areas, climbs } from "./schema";

export type Area = typeof areas.$inferSelect;
export type Climb = typeof climbs.$inferSelect;

export const PAGE_SIZE = 50;

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

export async function getSubtreeClimbs(
  db: Database,
  area: Area,
  page = 1,
): Promise<{ climbs: Climb[]; page: number; pageSize: number; hasNextPage: boolean }> {
  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db
    .select({ climb: climbs })
    .from(climbs)
    .innerJoin(areas, eq(climbs.areaId, areas.id))
    .where(and(gte(areas.lft, area.lft), lte(areas.rght, area.rght)))
    .orderBy(
      sql`(CASE WHEN ${climbs.type} = 'boulder' THEN 0 ELSE 1 END)`,
      asc(climbs.grade),
    )
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  const hasNextPage = rows.length > PAGE_SIZE;
  return {
    climbs: rows.slice(0, PAGE_SIZE).map((r) => r.climb),
    page,
    pageSize: PAGE_SIZE,
    hasNextPage,
  };
}

export async function searchAreas(db: Database, name: string): Promise<Area[]> {
  return db.all<Area>(sql`
    SELECT areas.* FROM areas
    JOIN areas_fts ON areas_fts.rowid = areas.id
    WHERE areas_fts MATCH ${name}
    ORDER BY rank
    LIMIT 25
  `);
}

type MatchedArea = { id: number; lft: number; rght: number };

export type Discipline = "boulder" | "rope";

export type SearchClimbsParams = {
  name?: string;
  areaName?: string;
  disciplines: Discipline[];
  boulderRange?: [number, number];
  ropeRange?: [number, number];
};

export async function searchClimbs(
  db: Database,
  params: SearchClimbsParams,
): Promise<Climb[]> {
  const conditions: SQL[] = [];

  if (params.name) {
    conditions.push(
      sql`climbs.id IN (SELECT rowid FROM climbs_fts WHERE climbs_fts MATCH ${params.name})`,
    );
  }

  if (params.areaName) {
    const matchedAreas = await db.all<MatchedArea>(sql`
      SELECT areas.id, areas.lft, areas.rght FROM areas
      JOIN areas_fts ON areas_fts.rowid = areas.id
      WHERE areas_fts MATCH ${params.areaName}
    `);

    // No area matched this name at all — no climb can satisfy the filter.
    if (matchedAreas.length === 0) return [];

    const rangeClauses = matchedAreas.map(
      (m) => sql`(areas.lft >= ${m.lft} AND areas.rght <= ${m.rght})`,
    );
    conditions.push(sql`(${sql.join(rangeClauses, sql` OR `)})`);
  }

  const disciplineClauses: SQL[] = [];
  if (params.disciplines.includes("boulder") && params.boulderRange) {
    const [min, max] = params.boulderRange;
    disciplineClauses.push(
      sql`(climbs.type = 'boulder' AND climbs.grade BETWEEN ${min} AND ${max})`,
    );
  }
  if (params.disciplines.includes("rope") && params.ropeRange) {
    const [min, max] = params.ropeRange;
    disciplineClauses.push(
      sql`(climbs.type IN ('sport', 'trad') AND climbs.grade BETWEEN ${min} AND ${max})`,
    );
  }
  if (disciplineClauses.length > 0) {
    conditions.push(sql`(${sql.join(disciplineClauses, sql` OR `)})`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  return db.all<Climb>(sql`
    SELECT climbs.* FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    ${whereClause}
    ORDER BY (CASE WHEN climbs.type = 'boulder' THEN 0 ELSE 1 END), climbs.grade
    LIMIT 25
  `);
}
