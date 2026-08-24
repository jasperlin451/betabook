import { eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { climbs } from "@/db/schema";
import { PAGE_SIZE, toFtsPrefixQuery } from "./shared";
import { areaNameCondition, type Area } from "./areas";

export type Climb = typeof climbs.$inferSelect;

export async function getClimb(db: Database, id: number): Promise<Climb | undefined> {
  return db.select().from(climbs).where(eq(climbs.id, id)).get();
}

export type SubtreeClimbsSort =
  | "name_asc"
  | "name_desc"
  | "grade_asc"
  | "grade_desc"
  | "rating_asc"
  | "rating_desc"
  | "ascents_asc"
  | "ascents_desc";

// NULLS LAST on the ascending variants keeps unknown-grade/unrated climbs at
// the bottom regardless of direction (same reasoning as getSendsForUserPage).
// Ascent count is COALESCEd to 0 (a LEFT JOIN with no sends yields NULL, not
// 0) so a never-sent climb sorts as a real zero, not last-via-NULL.
const SUBTREE_CLIMBS_ORDER_BY: Record<SubtreeClimbsSort, SQL> = {
  name_asc: sql`climbs.name ASC`,
  name_desc: sql`climbs.name DESC`,
  grade_asc: sql`climbs.grade ASC NULLS LAST`,
  grade_desc: sql`climbs.grade DESC`,
  rating_asc: sql`send_stats.avgRating ASC NULLS LAST`,
  rating_desc: sql`send_stats.avgRating DESC`,
  ascents_asc: sql`COALESCE(send_stats.sendCount, 0) ASC`,
  ascents_desc: sql`COALESCE(send_stats.sendCount, 0) DESC`,
};

export type Discipline = "boulder" | "sport" | "trad";

export type DisciplineGradeFilter = {
  disciplines: Discipline[];
  boulderRange?: [number, number];
  sportRange?: [number, number];
  tradRange?: [number, number];
};

/** Builds the discipline/grade OR-clause shared by `searchClimbs` and
 * `getSubtreeClimbs` — a climb matches if its own type is checked and its
 * grade falls in that discipline's range. Returns `[]` (no filtering) when
 * no disciplines are checked, per DEFAULT_USER_SENDS_FILTER's convention. */
function disciplineGradeConditions(filter: DisciplineGradeFilter): SQL[] {
  const clauses: SQL[] = [];
  if (filter.disciplines.includes("boulder") && filter.boulderRange) {
    const [min, max] = filter.boulderRange;
    clauses.push(sql`(climbs.type = 'boulder' AND climbs.grade BETWEEN ${min} AND ${max})`);
  }
  if (filter.disciplines.includes("sport") && filter.sportRange) {
    const [min, max] = filter.sportRange;
    clauses.push(sql`(climbs.type = 'sport' AND climbs.grade BETWEEN ${min} AND ${max})`);
  }
  if (filter.disciplines.includes("trad") && filter.tradRange) {
    const [min, max] = filter.tradRange;
    clauses.push(sql`(climbs.type = 'trad' AND climbs.grade BETWEEN ${min} AND ${max})`);
  }
  return clauses;
}

/** Rating and ascent count aren't columns on `climbs` — they're aggregates
 * over `sends` — so sorting by them means computing that aggregate before
 * paginating, in the same query, rather than as a separate post-pagination
 * lookup (see getClimbSendStats, which stays a separate display-only call
 * for the resulting page's climbs). `climbs.id` is a final deterministic
 * tie-break, replacing the old boulder-before-rope grouping now that an
 * explicit user-chosen sort supersedes it. */
export async function getSubtreeClimbs(
  db: Database,
  area: Area,
  page = 1,
  sort: SubtreeClimbsSort = "ascents_desc",
  filter?: DisciplineGradeFilter & { name?: string },
): Promise<{ climbs: Climb[]; page: number; pageSize: number; hasNextPage: boolean }> {
  const conditions: SQL[] = [sql`areas.lft >= ${area.lft} AND areas.rght <= ${area.rght}`];

  if (filter?.name) {
    const nameQuery = toFtsPrefixQuery(filter.name);
    if (!nameQuery) return { climbs: [], page, pageSize: PAGE_SIZE, hasNextPage: false };
    conditions.push(sql`climbs.id IN (SELECT rowid FROM climbs_fts WHERE climbs_fts MATCH ${nameQuery})`);
  }

  if (filter) {
    const disciplineClauses = disciplineGradeConditions(filter);
    if (disciplineClauses.length > 0) {
      conditions.push(sql`(${sql.join(disciplineClauses, sql` OR `)})`);
    }
  }

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<Climb>(sql`
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade
    FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    LEFT JOIN (
      SELECT climb_id, COUNT(*) AS sendCount, AVG(rating) AS avgRating
      FROM sends
      GROUP BY climb_id
    ) send_stats ON send_stats.climb_id = climbs.id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${SUBTREE_CLIMBS_ORDER_BY[sort]}, climbs.id
    LIMIT ${PAGE_SIZE + 1}
    OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const hasNextPage = rows.length > PAGE_SIZE;
  return {
    climbs: rows.slice(0, PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    hasNextPage,
  };
}

/** Exact (case-insensitive, trimmed) name match, in an area matching areaName exactly or as an ancestor. Returns every match — caller decides what 0/1/many means. */
export async function findClimbsByNameAndArea(
  db: Database,
  climbName: string,
  areaName: string,
): Promise<Climb[]> {
  return db.all<Climb>(sql`
    SELECT climbs.* FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    WHERE LOWER(TRIM(climbs.name)) = LOWER(TRIM(${climbName}))
    AND (
      LOWER(TRIM(areas.name)) = LOWER(TRIM(${areaName}))
      OR EXISTS (
        SELECT 1 FROM areas ancestor
        WHERE ancestor.lft < areas.lft AND ancestor.rght > areas.rght
        AND LOWER(TRIM(ancestor.name)) = LOWER(TRIM(${areaName}))
      )
    )
  `);
}

export type SearchClimbsParams = DisciplineGradeFilter & {
  name?: string;
  areaName?: string;
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

  const areaCondition = areaNameCondition(params.areaName);
  if (areaCondition) conditions.push(areaCondition);

  const disciplineClauses = disciplineGradeConditions(params);
  if (disciplineClauses.length > 0) {
    conditions.push(sql`(${sql.join(disciplineClauses, sql` OR `)})`);
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  // Explicit column aliases, not `climbs.*` — a raw-SQL wildcard returns
  // SQLite's actual (snake_case) column names, not drizzle's camelCase
  // field names, so `area_id` would come back as `area_id`, not `areaId`.
  return db.all<ClimbWithAreaName>(sql`
    SELECT
      climbs.id AS id,
      climbs.area_id AS areaId,
      climbs.name AS name,
      climbs.type AS type,
      climbs.grade AS grade,
      areas.name AS areaName
    FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    ${whereClause}
    ORDER BY (CASE WHEN climbs.type = 'boulder' THEN 0 ELSE 1 END), climbs.grade
    LIMIT 25
  `);
}
