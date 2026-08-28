import { eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { climbs } from "@/db/schema";
import { PAGE_SIZE, toFtsPrefixQuery } from "./shared";
import { areaNameCondition, type Area } from "./areas";

export type Climb = typeof climbs.$inferSelect;

export async function getClimb(db: Database, id: number): Promise<Climb | undefined> {
  return db.select().from(climbs).where(eq(climbs.id, id)).get();
}

/** Whether any climb is directly in `areaId` — an existence check (indexed
 * via climbs_area_idx), not a count. Deliberately not derived from
 * getSubtreeClimbs's result: that list is paginated and filtered by the
 * viewer's current sort/filter query params, so it can come back empty even
 * when the area has climbs. */
export async function hasClimbsInArea(db: Database, areaId: number): Promise<boolean> {
  const row = await db.select({ id: climbs.id }).from(climbs).where(eq(climbs.areaId, areaId)).limit(1).get();
  return row != null;
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
// rating_asc's `(climbs.avg_rating IS NULL), climbs.avg_rating` must match
// climbs_avg_rating_asc_idx's expression text structurally for SQLite to
// recognize the index as satisfying this ORDER BY (see
// drizzle/migrations/0012_climb_sort_indexes.sql) — CREATE INDEX has no
// NULLS FIRST/LAST syntax, so this expression idiom stands in for it.
// send_count/avg_rating are denormalized onto climbs (see
// drizzle/schema/climbs.ts) specifically so every one of these sorts can be
// satisfied by an index scan on climbs alone, with climbs.lft/rght as a
// residual filter, instead of joining an unscoped GROUP BY over all of
// `sends` on every query.
const SUBTREE_CLIMBS_ORDER_BY: Record<SubtreeClimbsSort, SQL> = {
  name_asc: sql`climbs.name ASC`,
  name_desc: sql`climbs.name DESC`,
  grade_asc: sql`(climbs.grade IS NULL), climbs.grade ASC`,
  grade_desc: sql`climbs.grade DESC`,
  rating_asc: sql`(climbs.avg_rating IS NULL), climbs.avg_rating ASC`,
  rating_desc: sql`climbs.avg_rating DESC`,
  ascents_asc: sql`climbs.send_count ASC`,
  ascents_desc: sql`climbs.send_count DESC`,
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

// SQLite commits to one query plan per prepared-statement SHAPE, not per
// call — it never sees bound host-parameter values at plan time, only the
// SQL text. Verified empirically: without a forced index, the exact same
// plan gets chosen for a tiny leaf area and a huge root area, whichever way
// the cost estimate happens to lean, so it's cheap for one extreme and does
// a near-full-table scan for the other. There's no query shape that lets
// the planner adapt per `area` the way this function is called with wildly
// different subtree sizes — INDEXED BY forces the right access path from a
// signal we DO know at query-build time: the area's own nested-set span
// (already loaded, no extra query).
//
// Below LARGE_AREA_SUBTREE_SPAN, climbs.lft/rght range-scans a small enough
// candidate set to sort in memory cheaply. At or above it, the sort-column
// index lets SQLite scan in the needed order and stop at LIMIT without ever
// reading the full subtree. Tuned from this dataset's actual area sizes:
// state/country-level areas (e.g. Alberta, ~8.8k climbs) top out around a
// span of 1200; continent-level areas (Europe, Canada, North America —
// tens of thousands of climbs each) start above 3500. 2000 sits in that gap.
const LARGE_AREA_SUBTREE_SPAN = 2000;

const SUBTREE_CLIMBS_SORT_INDEX: Record<SubtreeClimbsSort, string> = {
  name_asc: "climbs_name_asc_idx",
  name_desc: "climbs_name_desc_idx",
  grade_asc: "climbs_grade_asc_idx",
  grade_desc: "climbs_grade_desc_idx",
  rating_asc: "climbs_avg_rating_asc_idx",
  rating_desc: "climbs_avg_rating_desc_idx",
  ascents_asc: "climbs_send_count_asc_idx",
  ascents_desc: "climbs_send_count_desc_idx",
};

/** Rating and ascent count aren't columns on `climbs` — they're aggregates
 * over `sends` — so sorting by them means computing that aggregate before
 * paginating, in the same query, rather than as a separate post-pagination
 * lookup (see getClimbSendStats, which stays a separate display-only call
 * for the resulting page's climbs). `climbs.id` is a final deterministic
 * tie-break, replacing the old boulder-before-rope grouping now that an
 * explicit user-chosen sort supersedes it. */
export type ClimbStatsFilter = {
  ratingRange?: [number, number];
  minAscents?: number;
};

/** Adds the rating-range/min-ascents WHERE fragments shared by `searchClimbs`
 * and `getSubtreeClimbs` — both filter on climbs.avg_rating/send_count,
 * real denormalized columns (see drizzle/schema/climbs.ts), so this is a
 * plain predicate, no join or HAVING needed. A range at its full default
 * (or minAscents of 0) means the filter isn't active. A climb with no sends
 * has avg_rating IS NULL and send_count = 0, so it naturally fails either
 * condition once actually narrowed — no NULL special-casing required. */
function climbStatsConditions(filter: ClimbStatsFilter): SQL[] {
  const clauses: SQL[] = [];
  if (filter.ratingRange && (filter.ratingRange[0] > 0 || filter.ratingRange[1] < 5)) {
    const [min, max] = filter.ratingRange;
    clauses.push(sql`climbs.avg_rating BETWEEN ${min} AND ${max}`);
  }
  if (filter.minAscents) {
    clauses.push(sql`climbs.send_count >= ${filter.minAscents}`);
  }
  return clauses;
}

export async function getSubtreeClimbs(
  db: Database,
  area: Area,
  page = 1,
  sort: SubtreeClimbsSort = "ascents_desc",
  filter?: DisciplineGradeFilter & { name?: string } & ClimbStatsFilter,
): Promise<{ climbs: ClimbWithAreaName[]; page: number; pageSize: number; hasNextPage: boolean }> {
  // Both bounds on lft (not just the lower one) so the forced range index
  // can seek a bounded scan instead of an open-ended one — redundant given
  // rght <= area.rght already implies it for a valid nested-set descendant,
  // but SQLite's index-range-seek needs it spelled out on the indexed column
  // itself to stop early.
  const conditions: SQL[] = [
    sql`climbs.lft >= ${area.lft} AND climbs.lft <= ${area.rght} AND climbs.rght <= ${area.rght}`,
  ];

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
    conditions.push(...climbStatsConditions(filter));
  }

  const indexName =
    area.rght - area.lft >= LARGE_AREA_SUBTREE_SPAN
      ? SUBTREE_CLIMBS_SORT_INDEX[sort]
      : "climbs_lft_rght_idx";
  // sql.raw inlines this as literal SQL text with no parameter binding, so
  // it must never carry anything but one of these known index names —
  // callers are expected to validate `sort` first, but this guard keeps the
  // function safe even if a future caller doesn't.
  if (indexName !== "climbs_lft_rght_idx" && !Object.values(SUBTREE_CLIMBS_SORT_INDEX).includes(indexName)) {
    throw new Error(`Invalid index name: ${indexName}`);
  }

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<ClimbWithAreaName>(sql`
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade, areas.name AS areaName
    FROM climbs INDEXED BY ${sql.raw(indexName)}
    JOIN areas ON areas.id = climbs.area_id
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

export type SearchClimbsParams = DisciplineGradeFilter &
  ClimbStatsFilter & {
    name?: string;
    areaName?: string;
    sort?: SubtreeClimbsSort;
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
  conditions.push(...climbStatsConditions(params));

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
    ORDER BY ${SUBTREE_CLIMBS_ORDER_BY[params.sort ?? "ascents_desc"]}, climbs.id
    LIMIT 25
  `);
}
