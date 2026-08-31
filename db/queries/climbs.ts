import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
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

/** The set of `areaId` and every area beneath it, walked over `parent_id`.
 * Backed by areas_parent_idx, which the plan uses as a covering index.
 * SQLite materializes this once per query (plus a bloom filter) rather than
 * re-walking it per candidate row.
 *
 * UNION ALL, not UNION: seeded from a single id, each area is reached by
 * exactly one path down the tree, so there is nothing to dedup — and the walk
 * terminates because the tree is acyclic, which the triggers in
 * drizzle/migrations/0017_area_cycle_guard.sql enforce at write time. (Both
 * produce an identical query plan here; UNION would just be a dedup b-tree
 * doing no work.) Contrast areaNameCondition, which seeds from every
 * FTS-matched area at once — there one matched area can nest inside another,
 * so the same descendant really is reachable twice and UNION is doing
 * something. */
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
export const LARGE_AREA_SUBTREE_AREAS = 1000;

/** Whether `areaId`'s subtree reaches LARGE_AREA_SUBTREE_AREAS — the signal
 * getSubtreeClimbs forces its index from — as a SQL expression yielding 0/1,
 * so a caller already issuing a statement about this area can carry it along
 * instead of spending a round trip on it (see getAreaWithSubtreeSize). Only
 * the answer matters, never the size, so the LIMIT stops the walk as soon as
 * it has seen enough descendants to decide (EXPLAIN QUERY PLAN confirms
 * `CO-ROUTINE subtree` — it short-circuits rather than materializing the
 * subtree and then trimming it).
 *
 * That bounds the cost by the threshold, NOT by subtree size — which is a
 * weaker claim than "constant", and the difference matters if you're thinking
 * of putting this somewhere hotter. Emitting the LIMIT's worth of rows still
 * enqueues roughly LIMIT x fan-out rows into the recursive queue, so cost
 * climbs with area size up to the threshold and flattens above it: measured
 * over a synthetic fan-out-20 tree, ~0.001ms for a leaf crag, ~0.16ms at the
 * threshold, ~1.3ms for a 50k-area continent — where the same walk without
 * the LIMIT costs ~9.8ms. Every area page pays this once; a leaf pays
 * nothing, and the continents that pay ~2ms are the ones the resulting index
 * choice saves 20ms on.
 *
 * The recursive CTE sits INSIDE the scalar subquery rather than at statement
 * level so this is a self-contained expression, embeddable in a SELECT list.
 * `areaId` is bound, not correlated to the surrounding row, so nothing here
 * depends on where it lands.
 *
 * The LIMIT and the comparison are deliberately kept in one expression. They
 * have to agree — the count saturates at the LIMIT, so it can only ever reach
 * the threshold by hitting it exactly — and a mismatch between them wouldn't
 * fail loudly, it would just pin every area to the small-subtree index and
 * quietly give back the slow plan for the areas that most need the fast one. */
function reachesLargeSubtree(areaId: number): SQL<number> {
  return sql<number>`(SELECT count(*) FROM (
    ${subtreeAreaIds(areaId)}
    SELECT id FROM subtree LIMIT ${LARGE_AREA_SUBTREE_AREAS}
  )) >= ${LARGE_AREA_SUBTREE_AREAS}`;
}

/** The standalone probe — getSubtreeClimbs's fallback for callers that don't
 * already have the answer. Costs its own round trip; prefer
 * getAreaWithSubtreeSize, which folds the same predicate into the area lookup
 * those callers were making anyway. */
async function isLargeSubtree(db: Database, areaId: number): Promise<boolean> {
  const rows = await db.all<{ large: number }>(
    sql`SELECT ${reachesLargeSubtree(areaId)} AS large`,
  );
  return rows[0]?.large === 1;
}

export type AreaWithSubtreeSize = Area & { largeSubtree: boolean };

/** `getArea` plus getSubtreeClimbs's index-selection signal, resolved in the
 * one statement the caller was already issuing.
 *
 * The area page and the "load more" route both load the area before they can
 * do anything else, so computing the signal here costs them no extra round
 * trip — restoring what the nested-set columns used to give for free, without
 * giving up a live value. Callers that don't list climbs (the climb page, the
 * area/climb mutations) stay on plain getArea and don't pay the walk.
 *
 * Selected through drizzle's column spread rather than a raw `areas.*`: raw
 * SQL comes back under SQLite's own snake_case names, so `parentId` would
 * arrive as `parent_id` (the same trap searchClimbs's comment flags). */
export async function getAreaWithSubtreeSize(
  db: Database,
  id: number,
): Promise<AreaWithSubtreeSize | undefined> {
  const row = await db
    .select({ ...getTableColumns(areas), largeSubtree: reachesLargeSubtree(id) })
    .from(areas)
    .where(eq(areas.id, id))
    .get();

  // SQLite has no boolean type — the comparison comes back as 0/1.
  return row && { ...row, largeSubtree: row.largeSubtree === 1 };
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

/** Hand it an AreaWithSubtreeSize and the index-selection signal rides along
 * on the row, costing nothing (see getAreaWithSubtreeSize, which is what both
 * production callers load `area` with); hand it a plain Area and the signal is
 * measured in its own round trip (see isLargeSubtree).
 *
 * Carried on `area` rather than passed beside it so the signal can't be about
 * a different area than the one being listed — the two travel together or not
 * at all. A test that wants a specific branch on a fixture too small to earn
 * it spreads the flag on: `{ ...area, largeSubtree: true }`. */
export async function getSubtreeClimbs(
  db: Database,
  area: Area | AreaWithSubtreeSize,
  page = 1,
  sort: SubtreeClimbsSort = "ascents_desc",
  filter?: DisciplineGradeFilter & { name?: string } & ClimbStatsFilter,
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

  const isLarge = "largeSubtree" in area ? area.largeSubtree : await isLargeSubtree(db, area.id);
  const indexName = isLarge ? SUBTREE_CLIMBS_SORT_INDEX[sort] : "climbs_area_idx";

  // Fetch one extra row to detect a next page without a separate COUNT query.
  // Small subtrees sort their (few) rows anyway, so ties get the full
  // deterministic chain; the large-area path must keep an ORDER BY its
  // forced sort index satisfies verbatim (see SUBTREE_CLIMBS_TIE_BREAK).
  // Keyed on the size decision itself, not on the index name it produces:
  // naming the index here is what silently dropped the chain when the small
  // -area index was renamed.
  const orderBy = isLarge
    ? sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, climbs.id`
    : sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, ${sortTieBreak(sort)}, climbs.id`;

  const rows = await db.all<ClimbWithAreaName>(sql`
    ${subtreeAreaIds(area.id)}
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

export type GradeHistogramRow = { type: Discipline; grade: number | null; count: number };

/** Grade distribution of every climb in an area's subtree — one query powers
 * the crag header's histogram, climb count, grade span, and discipline list.
 *
 * The result is tiny (bounded by distinct (type, grade) pairs, ~55 at most),
 * but the COST is a row read per climb in the subtree, so callers gate this
 * on the same `largeSubtree` signal getSubtreeClimbs forces its index from
 * rather than running it for a continent. */
export async function getSubtreeGradeHistogram(
  db: Database,
  area: Area,
): Promise<GradeHistogramRow[]> {
  return db.all<GradeHistogramRow>(sql`
    ${subtreeAreaIds(area.id)}
    SELECT climbs.type AS type, climbs.grade AS grade, COUNT(*) AS count
    FROM climbs
    WHERE climbs.area_id IN (SELECT id FROM subtree)
    GROUP BY climbs.type, climbs.grade
  `);
}

/** The subset of climb fields findClimbsByNameAndArea selects — everything
 * the import path needs to resolve a row, dedupe it, and revalidate the
 * affected climb/area pages. */
export type ClimbNameAreaMatch = Pick<Climb, "id" | "areaId" | "name" | "type" | "grade">;

/** Exact (case-insensitive, trimmed) name match, in an area matching areaName
 * exactly or as an ancestor. Returns every match — caller decides what
 * 0/1/many means.
 *
 * Walks `parent_id` UPWARD from the candidate climbs' areas, testing each
 * ancestor's name — the opposite direction from areaNameCondition, which
 * resolves the named area's whole descendant set once. That difference is
 * deliberate, and it's about which side of the join is the small one:
 *
 * areaNameCondition drives from a broad row set (an FTS climb search, a
 * user's entire send history), so a per-row ancestor test ran thousands of
 * times and materializing the descendant set once was the win. Here the
 * driver is an EXACT climb-name match on climbs_name_lower_idx (see
 * drizzle/migrations/0006_expression_indexes.sql), which yields a handful of
 * rows — so the descendant set is the expensive side, and its cost scales
 * with the named area's subtree: a country- or continent-level areaName
 * means materializing thousands of areas to test a few climbs.
 *
 * An ancestor chain is bounded by tree depth regardless of subtree size (see
 * getAncestors), so this is O(candidate areas x depth) and doesn't scale with
 * the named area at all. That matters per CALL, not just per query:
 * importSends resolves one of these per CSV row.
 *
 * Seeding `chain` with the climb's own area is what folds "matches exactly OR
 * matches as an ancestor" into one clause. UNION ALL is safe because an
 * ancestor chain can't cycle — enforced at write time by the triggers in
 * drizzle/migrations/0017_area_cycle_guard.sql, not merely assumed from the
 * current mutations. That matters most here: this runs once per CSV row on
 * the import path, so it's the walk with the least headroom to spare. */
export async function findClimbsByNameAndArea(
  db: Database,
  climbName: string,
  areaName: string,
): Promise<ClimbNameAreaMatch[]> {
  // Raw-SQL db.all skips drizzle's column mapping and keeps database field
  // names, so snake_case columns are aliased explicitly (as in searchClimbs)
  // — `climbs.*` would come back with `area_id`, not `areaId`.
  return db.all<ClimbNameAreaMatch>(sql`
    WITH RECURSIVE chain(start_id, id) AS (
      SELECT DISTINCT c.area_id, c.area_id FROM climbs c
      WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(${climbName}))
      UNION ALL
      SELECT chain.start_id, areas.parent_id FROM chain
      JOIN areas ON areas.id = chain.id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade
    FROM climbs
    WHERE LOWER(TRIM(climbs.name)) = LOWER(TRIM(${climbName}))
    AND climbs.area_id IN (
      SELECT chain.start_id FROM chain
      JOIN areas ON areas.id = chain.id
      WHERE LOWER(TRIM(areas.name)) = LOWER(TRIM(${areaName}))
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
