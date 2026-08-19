import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { PAGE_SIZE, toFtsPrefixQuery } from "./shared";
import type { Area } from "./areas";

export type Climb = typeof climbs.$inferSelect;

export async function getClimb(db: Database, id: number): Promise<Climb | undefined> {
  return db.select().from(climbs).where(eq(climbs.id, id)).get();
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

type MatchedArea = { id: number; lft: number; rght: number };

export type Discipline = "boulder" | "sport" | "trad";

export type SearchClimbsParams = {
  name?: string;
  areaName?: string;
  disciplines: Discipline[];
  boulderRange?: [number, number];
  sportRange?: [number, number];
  tradRange?: [number, number];
};

export type ClimbWithAreaName = Climb & { areaName: string };

export async function searchClimbs(
  db: Database,
  params: SearchClimbsParams,
): Promise<ClimbWithAreaName[]> {
  const conditions: SQL[] = [];

  if (params.name) {
    const nameQuery = toFtsPrefixQuery(params.name);
    if (!nameQuery) return [];
    conditions.push(
      sql`climbs.id IN (SELECT rowid FROM climbs_fts WHERE climbs_fts MATCH ${nameQuery})`,
    );
  }

  if (params.areaName) {
    const areaNameQuery = toFtsPrefixQuery(params.areaName);
    if (!areaNameQuery) return [];

    const matchedAreas = await db.all<MatchedArea>(sql`
      SELECT areas.id, areas.lft, areas.rght FROM areas
      JOIN areas_fts ON areas_fts.rowid = areas.id
      WHERE areas_fts MATCH ${areaNameQuery}
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
  if (params.disciplines.includes("sport") && params.sportRange) {
    const [min, max] = params.sportRange;
    disciplineClauses.push(
      sql`(climbs.type = 'sport' AND climbs.grade BETWEEN ${min} AND ${max})`,
    );
  }
  if (params.disciplines.includes("trad") && params.tradRange) {
    const [min, max] = params.tradRange;
    disciplineClauses.push(
      sql`(climbs.type = 'trad' AND climbs.grade BETWEEN ${min} AND ${max})`,
    );
  }
  if (disciplineClauses.length > 0) {
    conditions.push(sql`(${sql.join(disciplineClauses, sql` OR `)})`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  return db.all<ClimbWithAreaName>(sql`
    SELECT climbs.*, areas.name AS areaName FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    ${whereClause}
    ORDER BY (CASE WHEN climbs.type = 'boulder' THEN 0 ELSE 1 END), climbs.grade
    LIMIT 25
  `);
}
