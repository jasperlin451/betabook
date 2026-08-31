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
// satisfied by an index scan on climbs alone, with subtree membership as a
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

/** The set of `areaId` and every area beneath it, walked over `parent_id`.
 * Backed by areas_parent_idx, which the plan uses as a covering index.
 * SQLite materializes this once per query (plus a bloom filter) rather than
 * re-walking it per candidate row. */
function subtreeAreaIds(areaId: number): SQL {
  return sql`
    WITH RECURSIVE subtree(id) AS (
      SELECT ${areaId}
      UNION ALL
      SELECT a.id FROM areas a JOIN subtree s ON a.parent_id = s.id
    )`;
}

// SQLite commits to one query plan per prepared-statement SHAPE, not per
// call — it never sees bound host-parameter values at plan time, only the
// SQL text. Verified empirically: without a forced index, the exact same
// plan gets chosen for a tiny leaf area and a huge root area, whichever way
// the cost estimate happens to lean, so it's cheap for one extreme and does
// a near-full-table scan for the other. (Re-verified after the move to
// parent_id: unhinted, North America picks climbs_area_idx plus a temp
// b-tree over all 83,916 of its climbs — 24ms against 4ms hinted.) There's
// no query shape that lets the planner adapt per `area`, so INDEXED BY
// forces the access path from a signal we resolve at query-build time.
//
// Below LARGE_AREA_SUBTREE_AREAS, climbs_area_idx gathers a small enough
// candidate set to sort in memory cheaply. At or above it, the sort-column
// index lets SQLite scan in the needed order and stop at LIMIT without ever
// reading the full subtree. Tuned from this dataset's actual area sizes:
// state/country-level areas (e.g. Alberta, ~8.8k climbs) top out around 600
// subtree areas; continent-level areas (Europe, Canada, North America — tens
// of thousands of climbs each) start above 1750. 1000 sits in that gap.
//
// This replaces an equivalent threshold of 2000 on the old nested-set span:
// a subtree of N areas spans exactly 2N-1, so the classification is
// unchanged. Unlike that span — a snapshot only as fresh as the last
// recompute — this is a live count.
const LARGE_AREA_SUBTREE_AREAS = 1000;

/** Whether `areaId`'s subtree reaches LARGE_AREA_SUBTREE_AREAS — the signal
 * getSubtreeClimbs forces its index from. Only the answer matters, never the
 * size, so the walk stops as soon as it has seen enough descendants to decide:
 * a continent costs the same probe as a crag (~2ms on this dataset).
 *
 * The LIMIT and the comparison are deliberately kept in one expression. They
 * have to agree — the count saturates at the LIMIT, so it can only ever reach
 * the threshold by hitting it exactly — and a mismatch between them wouldn't
 * fail loudly, it would just pin every area to the small-subtree index and
 * quietly give back the slow plan for the areas that most need the fast one. */
async function isLargeSubtree(db: Database, areaId: number): Promise<boolean> {
  const rows = await db.all<{ count: number }>(sql`
    SELECT count(*) AS count FROM (
      ${subtreeAreaIds(areaId)}
      SELECT id FROM subtree LIMIT ${LARGE_AREA_SUBTREE_AREAS}
    )
  `);
  return (rows[0]?.count ?? 0) >= LARGE_AREA_SUBTREE_AREAS;
}

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

/** `largeSubtree` lets a caller that already knows which branch it wants skip
 * the extra probe query; omit it and it's measured (see isLargeSubtree). */
export async function getSubtreeClimbs(
  db: Database,
  area: Area,
  page = 1,
  sort: SubtreeClimbsSort = "ascents_desc",
  filter?: DisciplineGradeFilter & { name?: string } & ClimbStatsFilter,
  largeSubtree?: boolean,
): Promise<{ climbs: ClimbWithAreaName[]; page: number; pageSize: number; hasNextPage: boolean }> {
  const conditions: SQL[] = [sql`climbs.area_id IN (SELECT id FROM subtree)`];

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

  // Callers are expected to validate `sort`, but check it here too: an
  // unknown key yields `undefined` from both lookup tables below, which would
  // inline a bare `undefined` into the ORDER BY and — via sql.raw, which
  // binds nothing and interpolates literal SQL text — into the INDEXED BY.
  // Checking the key itself rather than the resolved index name catches it on
  // whichever branch we take.
  if (!Object.prototype.hasOwnProperty.call(SUBTREE_CLIMBS_SORT_INDEX, sort)) {
    throw new Error(`Invalid sort value: ${sort}`);
  }

  const isLarge = largeSubtree ?? (await isLargeSubtree(db, area.id));
  const indexName = isLarge ? SUBTREE_CLIMBS_SORT_INDEX[sort] : "climbs_area_idx";

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<ClimbWithAreaName>(sql`
    ${subtreeAreaIds(area.id)}
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

/** Exact (case-insensitive, trimmed) name match, in an area matching areaName
 * exactly or as an ancestor. Returns every match — caller decides what
 * 0/1/many means.
 *
 * The area set is resolved once by walking `parent_id` down from every
 * name-matching area, rather than by a correlated per-climb ancestor test —
 * same reasoning (and same order-of-magnitude speedup) as areaNameCondition.
 * Seeding the walk with the matching areas themselves is what folds the old
 * "matches exactly OR matches as an ancestor" disjunction into one clause. */
export async function findClimbsByNameAndArea(
  db: Database,
  climbName: string,
  areaName: string,
): Promise<Climb[]> {
  return db.all<Climb>(sql`
    SELECT climbs.* FROM climbs
    WHERE LOWER(TRIM(climbs.name)) = LOWER(TRIM(${climbName}))
    AND climbs.area_id IN (
      WITH RECURSIVE matched(id) AS (
        SELECT m.id FROM areas m
        WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(${areaName}))
        UNION
        SELECT child.id FROM areas child JOIN matched ON child.parent_id = matched.id
      )
      SELECT id FROM matched
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
