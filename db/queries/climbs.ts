import { eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { climbs } from "@/db/schema";
import { MAX_RATING } from "@/lib/climb-stats-filter";
import {
  DEFAULT_BOULDER_RANGE,
  DEFAULT_SPORT_RANGE,
  DEFAULT_TRAD_RANGE,
} from "@/lib/discipline-filter";
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

/** Deterministic tie-breaks after the chosen sort, in name → grade →
 * rating → ascents priority (minus whichever is primary), impressive-first
 * directions. Only appended on paths that sort anyway (search, and
 * small-area subtrees on the plain range index): the large-area path's
 * whole point is that its forced sort index satisfies the ORDER BY without
 * sorting the subtree, and extra keys would void that — there, ties fall
 * back to climbs.id as before. */
const SUBTREE_CLIMBS_TIE_BREAK: Record<"name" | "grade" | "rating" | "ascents", SQL> = {
  name: sql`climbs.grade DESC, climbs.avg_rating DESC, climbs.send_count DESC`,
  grade: sql`climbs.name ASC, climbs.avg_rating DESC, climbs.send_count DESC`,
  rating: sql`climbs.name ASC, climbs.grade DESC, climbs.send_count DESC`,
  ascents: sql`climbs.name ASC, climbs.grade DESC, climbs.avg_rating DESC`,
};

function sortTieBreak(sort: SubtreeClimbsSort): SQL {
  const field = sort.replace(/_(asc|desc)$/, "") as keyof typeof SUBTREE_CLIMBS_TIE_BREAK;
  return SUBTREE_CLIMBS_TIE_BREAK[field];
}

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
 * no disciplines are checked, per DEFAULT_USER_SENDS_FILTER's convention.
 *
 * Same NULL-grade semantics as the user-sends filter's
 * disciplineGradeClause: at the full default range there's no grade
 * predicate, so ungraded climbs stay (ticking "Boulder" used to silently
 * drop every ungraded boulder — right under a crag header advertising
 * them); once a bound is narrowed, NULL fails the BETWEEN and is excluded,
 * since an unknown grade can't be known to fall inside a narrowed range. */
function disciplineGradeCondition(
  type: Discipline,
  range: [number, number],
  fullRange: [number, number],
): SQL {
  const [min, max] = range;
  if (min <= fullRange[0] && max >= fullRange[1]) return sql`climbs.type = ${type}`;
  return sql`(climbs.type = ${type} AND climbs.grade BETWEEN ${min} AND ${max})`;
}

function disciplineGradeConditions(filter: DisciplineGradeFilter): SQL[] {
  const clauses: SQL[] = [];
  if (filter.disciplines.includes("boulder") && filter.boulderRange) {
    clauses.push(disciplineGradeCondition("boulder", filter.boulderRange, DEFAULT_BOULDER_RANGE));
  }
  if (filter.disciplines.includes("sport") && filter.sportRange) {
    clauses.push(disciplineGradeCondition("sport", filter.sportRange, DEFAULT_SPORT_RANGE));
  }
  if (filter.disciplines.includes("trad") && filter.tradRange) {
    clauses.push(disciplineGradeCondition("trad", filter.tradRange, DEFAULT_TRAD_RANGE));
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
export const LARGE_AREA_SUBTREE_SPAN = 2000;

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
 * plain predicate, no join or HAVING needed. Each rating bound is emitted
 * independently: a bound of 0 is the "Any" sentinel (that side is inactive
 * — see lib/climb-stats-filter.ts), and a max at MAX_RATING is inactive
 * too, since no avg_rating exceeds it and emitting it anyway would wrongly
 * drop unrated climbs from the default view. A climb with no ratings has
 * avg_rating IS NULL (and send_count = 0 with no sends), so it naturally
 * fails whichever bound is actually active — no NULL special-casing
 * required; minAscents of 0 likewise means inactive. */
function climbStatsConditions(filter: ClimbStatsFilter): SQL[] {
  const clauses: SQL[] = [];
  if (filter.ratingRange) {
    const [min, max] = filter.ratingRange;
    if (min > 0) clauses.push(sql`climbs.avg_rating >= ${min}`);
    if (max > 0 && max < MAX_RATING) clauses.push(sql`climbs.avg_rating <= ${max}`);
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
  // Small subtrees sort their (few) rows anyway, so ties get the full
  // deterministic chain; the large-area path must keep an ORDER BY its
  // forced sort index satisfies verbatim (see SUBTREE_CLIMBS_TIE_BREAK).
  const orderBy =
    indexName === "climbs_lft_rght_idx"
      ? sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, ${sortTieBreak(sort)}, climbs.id`
      : sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, climbs.id`;

  const rows = await db.all<ClimbWithAreaName>(sql`
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade, areas.name AS areaName
    FROM climbs INDEXED BY ${sql.raw(indexName)}
    JOIN areas ON areas.id = climbs.area_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${orderBy}
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
export type GradeHistogramRow = { type: Discipline; grade: number | null; count: number };

/** Grade distribution of every climb in an area's subtree — one query
 * powers the crag header's histogram, climb count, grade span, and
 * discipline list. Same residual-range predicate as getSubtreeClimbs
 * (including the redundant-looking second lft bound — see the comment
 * there); no ORDER BY/LIMIT, so the plain range index is always the right
 * access path and none of the sort-index forcing applies. Result size is
 * bounded by distinct (type, grade) pairs (≤ ~55) — but COST is a table
 * lookup per climb in range, so callers gate on the same
 * LARGE_AREA_SUBTREE_SPAN threshold the list query uses (and on the
 * lft=rght=0 placeholder a freshly created, not-yet-reindexed area
 * carries, whose "range" would match every other unindexed climb). */
export async function getSubtreeGradeHistogram(
  db: Database,
  area: Area,
): Promise<GradeHistogramRow[]> {
  return db.all<GradeHistogramRow>(sql`
    SELECT climbs.type AS type, climbs.grade AS grade, COUNT(*) AS count
    FROM climbs INDEXED BY climbs_lft_rght_idx
    WHERE climbs.lft >= ${area.lft} AND climbs.lft <= ${area.rght} AND climbs.rght <= ${area.rght}
    GROUP BY climbs.type, climbs.grade
  `);
}

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

/** Search pages are smaller than the area page's PAGE_SIZE — the search
 * surface renders richer per-row context (breadcrumbs, send stats) for
 * results spanning the whole database, so the first paint stays light and
 * "load more" (see /api/search/climbs) fetches the rest on demand. */
export const SEARCH_PAGE_SIZE = 25;

/** The shared WHERE fragments for `searchClimbs`/`countSearchClimbs`, so the
 * page and its count can never drift apart. Returns `null` when the name has
 * no matchable FTS tokens — "matches nothing", as distinct from `[]`, which
 * means "no filtering at all". */
function searchClimbsConditions(params: SearchClimbsParams): SQL[] | null {
  const conditions: SQL[] = [];

  if (params.name) {
    const nameQuery = toFtsPrefixQuery(params.name);
    if (!nameQuery) return null;
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

  return conditions;
}

function searchClimbsWhereClause(conditions: SQL[]): SQL {
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
}

export type SearchClimbsPage = { climbs: ClimbWithAreaName[]; hasNextPage: boolean };

export async function searchClimbs(
  db: Database,
  params: SearchClimbsParams,
  page = 1,
): Promise<SearchClimbsPage> {
  const conditions = searchClimbsConditions(params);
  if (conditions === null) return { climbs: [], hasNextPage: false };

  // Explicit column aliases, not `climbs.*` — a raw-SQL wildcard returns
  // SQLite's actual (snake_case) column names, not drizzle's camelCase
  // field names, so `area_id` would come back as `area_id`, not `areaId`.
  //
  // Fetch one extra row to detect a next page without a separate COUNT query
  // (the count exists — see countSearchClimbs — but only the first
  // server-rendered page pays for it, not every "load more").
  const rows = await db.all<ClimbWithAreaName>(sql`
    SELECT
      climbs.id AS id,
      climbs.area_id AS areaId,
      climbs.name AS name,
      climbs.type AS type,
      climbs.grade AS grade,
      areas.name AS areaName
    FROM climbs
    JOIN areas ON areas.id = climbs.area_id
    ${searchClimbsWhereClause(conditions)}
    ORDER BY ${SUBTREE_CLIMBS_ORDER_BY[params.sort ?? "ascents_desc"]}, ${sortTieBreak(params.sort ?? "ascents_desc")}, climbs.id
    LIMIT ${SEARCH_PAGE_SIZE + 1}
    OFFSET ${(page - 1) * SEARCH_PAGE_SIZE}
  `);

  return {
    climbs: rows.slice(0, SEARCH_PAGE_SIZE),
    hasNextPage: rows.length > SEARCH_PAGE_SIZE,
  };
}

/** Exact match count for the same conditions as `searchClimbs` — a single
 * aggregate over index/FTS-backed predicates, cheap relative to the page
 * query itself, so the search heading can show a real total instead of a
 * silent cap. The areas join exists only for areaNameCondition's
 * correlation (it references the outer `areas` row); with no area-name
 * filter it would add a pointless per-climb PK seek to the scan, so it's
 * joined only when needed. Callers should skip the count entirely for a
 * fully unfiltered search (see app/page.tsx) — COUNT(*) over every climb
 * is a full index scan with nothing to show for it on a default landing. */
export async function countSearchClimbs(
  db: Database,
  params: SearchClimbsParams,
): Promise<number> {
  const conditions = searchClimbsConditions(params);
  if (conditions === null) return 0;

  const areasJoin = params.areaName ? sql`JOIN areas ON areas.id = climbs.area_id` : sql``;
  const [row] = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM climbs
    ${areasJoin}
    ${searchClimbsWhereClause(conditions)}
  `);
  return row?.count ?? 0;
}
