import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { MAX_RATING } from "@/lib/climb-stats-filter";
import {
  DEFAULT_BOULDER_RANGE,
  DEFAULT_SPORT_RANGE,
  DEFAULT_TRAD_RANGE,
  type DisciplineGradeFilter,
} from "@/lib/discipline-filter";
import type { Discipline } from "@/lib/grades";

import { areaNameCondition, type Area } from "./areas";
import { PAGE_SIZE, toFtsPrefixQuery } from "./shared";

export type Climb = typeof climbs.$inferSelect;

export async function getClimb(db: Database, id: number): Promise<Climb | undefined> {
  return db.select().from(climbs).where(eq(climbs.id, id)).get();
}

/** Total climb rows — sizes the sitemap shard count (see app/sitemap.ts). */
export async function countClimbs(db: Database): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(climbs)
    .get();
  return row?.count ?? 0;
}

/** One page of climb ids in id order — a sitemap shard. Keyset would be
 * tighter, but the sitemap runs a few times a day and OFFSET over an
 * integer PK stays an index scan. */
export async function getClimbIdsPage(
  db: Database,
  limit: number,
  offset: number,
): Promise<number[]> {
  const rows = await db
    .select({ id: climbs.id })
    .from(climbs)
    .orderBy(climbs.id)
    .limit(limit)
    .offset(offset)
    .all();
  return rows.map((row) => row.id);
}

/** Whether any climb is directly in `areaId` — an existence check (indexed
 * via climbs_area_idx), not a count. Deliberately not derived from
 * getSubtreeClimbs's result: that list is paginated and filtered by the
 * viewer's current sort/filter query params, so it can come back empty even
 * when the area has climbs. */
export async function hasClimbsInArea(db: Database, areaId: number): Promise<boolean> {
  const row = await db
    .select({ id: climbs.id })
    .from(climbs)
    .where(eq(climbs.areaId, areaId))
    .limit(1)
    .get();
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

export type { Discipline } from "@/lib/grades";
export type { DisciplineGradeFilter } from "@/lib/discipline-filter";

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

/** Short prefix terms tend to match a large share of the global FTS table.
 * Driving from FTS in that case materializes and sorts the whole match set;
 * the large-area sort index is the bounded path because it can stop at LIMIT.
 * A longer term is selective enough to justify FTS-first for rare matches. */
const MIN_LARGE_AREA_FTS_DRIVER_TERM_LENGTH = 3;

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
  const rows = await db.all<{ large: number }>(sql`SELECT ${reachesLargeSubtree(areaId)} AS large`);
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
// oxlint-disable-next-line complexity -- sort / discipline / pagination / large-subtree branches
export async function getSubtreeClimbs(
  db: Database,
  area: Area | AreaWithSubtreeSize,
  page = 1,
  sort: SubtreeClimbsSort = "ascents_desc",
  filter?: DisciplineGradeFilter & { name?: string } & ClimbStatsFilter,
  pageSize = PAGE_SIZE,
  offset = (page - 1) * pageSize,
): Promise<{ climbs: ClimbWithAreaName[]; page: number; pageSize: number; hasNextPage: boolean }> {
  const conditions: SQL[] = [sql`climbs.area_id IN (SELECT id FROM subtree)`];

  const nameQuery = filter?.name ? toFtsPrefixQuery(filter.name) : null;
  if (filter?.name && !nameQuery) return { climbs: [], page, pageSize, hasNextPage: false };

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
  // A global sort index is ideal for broad continent-sized lists because it
  // can stop as soon as LIMIT is filled. It is the wrong driver for a rare
  // name, though: it may scan that global index to exhaustion to find zero
  // matches. In that shape, drive from the selective FTS table and accept a
  // tiny result sort instead. One- and two-character terms stay on the sort
  // index and use a correlated rowid-constrained FTS probe, avoiding both the
  // global FTS result sort and an eagerly materialized IN-list.
  const longestNameTerm = Math.max(
    0,
    ...(filter?.name
      ?.trim()
      .split(/\s+/)
      .map((term) => term.length) ?? []),
  );
  const useNameIndex =
    isLarge && nameQuery !== null && longestNameTerm >= MIN_LARGE_AREA_FTS_DRIVER_TERM_LENGTH;
  if (nameQuery) {
    conditions.push(
      useNameIndex
        ? sql`climbs_fts MATCH ${nameQuery}`
        : isLarge
          ? sql`EXISTS (
              SELECT 1 FROM climbs_fts
              WHERE climbs_fts.rowid = climbs.id AND climbs_fts MATCH ${nameQuery}
            )`
          : sql`climbs.id IN (
              SELECT rowid FROM climbs_fts WHERE climbs_fts MATCH ${nameQuery}
            )`,
    );
  }
  const indexName = isLarge ? SUBTREE_CLIMBS_SORT_INDEX[sort] : "climbs_area_idx";

  // Fetch one extra row to detect a next page without a separate COUNT query.
  // Small subtrees sort their (few) rows anyway, so ties get the full
  // deterministic chain; the large-area path must keep an ORDER BY its
  // forced sort index satisfies verbatim (see SUBTREE_CLIMBS_TIE_BREAK).
  // Keyed on the size decision itself, not on the index name it produces:
  // naming the index here is what silently dropped the chain when the small
  // -area index was renamed.
  const orderBy =
    isLarge && !useNameIndex
      ? sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, climbs.id`
      : sql`${SUBTREE_CLIMBS_ORDER_BY[sort]}, ${sortTieBreak(sort)}, climbs.id`;
  const climbSource = useNameIndex
    ? sql`climbs_fts JOIN climbs ON climbs.id = climbs_fts.rowid`
    : sql`climbs INDEXED BY ${sql.raw(indexName)}`;

  const rows = await db.all<ClimbWithAreaName>(sql`
    ${subtreeAreaIds(area.id)}
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade, areas.name AS areaName
    FROM ${climbSource}
    JOIN areas ON areas.id = climbs.area_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${orderBy}
    LIMIT ${pageSize + 1}
    OFFSET ${offset}
  `);

  const hasNextPage = rows.length > pageSize;
  return {
    climbs: rows.slice(0, pageSize),
    page,
    pageSize,
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

/** The climb fields the import path needs to write a send against a resolved
 * climb, dedupe it, and revalidate the affected climb/area pages. */
export type ClimbSummary = Pick<Climb, "id" | "areaId" | "name" | "type" | "grade">;

/** The named climbs by id, in no particular order; ids with no climb are
 * simply absent. One statement however many ids, bound as a single JSON
 * value (see getUserSentClimbIds for why). */
export async function getClimbsByIds(
  db: Database,
  ids: readonly number[],
): Promise<ClimbSummary[]> {
  const distinct = [...new Set(ids)];
  if (distinct.length === 0) return [];
  return db.all<ClimbSummary>(sql`
    SELECT climbs.id AS id, climbs.area_id AS areaId, climbs.name AS name,
           climbs.type AS type, climbs.grade AS grade
    FROM climbs
    WHERE climbs.id IN (SELECT CAST(value AS INTEGER) FROM json_each(${JSON.stringify(distinct)}))
  `);
}

/** One climb that shares a looked-up name, with enough of its surroundings
 * for the import wizard to tell same-named climbs apart without another
 * round trip. */
export type ClimbCandidate = Pick<
  Climb,
  "id" | "areaId" | "name" | "type" | "grade" | "sendCount"
> & {
  /** `LOWER(TRIM(name))` as SQLite computed it — what callers group by, and
   * what lib/import-matching's foldClimbName reproduces for the CSV side. */
  key: string;
  areaName: string;
  /** The climb's area's ancestors, root-first, not including the area itself.
   * Empty for a climb in a root area. */
  ancestors: { id: number; name: string }[];
  /** How many climbs share `key` in all, before CLIMB_CANDIDATES_PER_NAME
   * trimmed the list — so the caller can say "showing 25 of 60". */
  total: number;
};

/** Same-named climbs past this many are cut, most-ascended kept. A name that
 * common ("Warm Up") won't be settled from a list; the wizard's search is. */
export const CLIMB_CANDIDATES_PER_NAME = 25;

type ClimbCandidateRow = Omit<ClimbCandidate, "ancestors"> & { ancestors: string };

function toCandidates(rows: ClimbCandidateRow[]): ClimbCandidate[] {
  return rows.map((row) => ({
    ...row,
    ancestors: JSON.parse(row.ancestors) as ClimbCandidate["ancestors"],
  }));
}

/** Every climb named `name` whose own area or any ancestor is named
 * `areaName` (both case-insensitive, trimmed), for each pair, with the same
 * fields as findClimbCandidatesByNames. No per-name cap: this is how the
 * wizard reaches a climb that a common name's cap left out when the CSV
 * says which area it is in (see areaLookupsNeeded). `total` still counts
 * every climb of the name, cap or no cap, so the two lookups agree. */
export async function findClimbCandidatesInAreas(
  db: Database,
  pairs: readonly { name: string; areaName: string }[],
): Promise<ClimbCandidate[]> {
  if (pairs.length === 0) return [];

  // The chain is seeded with each climb's own area at distance 0, so one walk
  // both tests the area (any distance) and yields the ancestors (distance
  // 1+), instead of two recursive CTEs over the same rows.
  const rows = await db.all<ClimbCandidateRow>(sql`
    WITH RECURSIVE wanted(key, area) AS (
      SELECT LOWER(TRIM(json_extract(value, '$.name'))), LOWER(TRIM(json_extract(value, '$.areaName')))
      FROM json_each(${JSON.stringify(pairs)})
    ), named AS (
      SELECT climbs.id, climbs.area_id, climbs.name, climbs.type, climbs.grade,
             climbs.send_count, LOWER(TRIM(climbs.name)) AS key,
             COUNT(*) OVER (PARTITION BY LOWER(TRIM(climbs.name))) AS total
      FROM climbs
      WHERE LOWER(TRIM(climbs.name)) IN (SELECT key FROM wanted)
    ), chain(climb_id, area_id, dist) AS (
      SELECT named.id, named.area_id, 0 FROM named
      UNION ALL
      SELECT chain.climb_id, areas.parent_id, chain.dist + 1
      FROM chain
      JOIN areas ON areas.id = chain.area_id
      WHERE areas.parent_id IS NOT NULL
    ), matched AS (
      SELECT named.* FROM named
      WHERE EXISTS (
        SELECT 1 FROM chain
        JOIN areas ON areas.id = chain.area_id
        JOIN wanted ON wanted.key = named.key AND wanted.area = LOWER(TRIM(areas.name))
        WHERE chain.climb_id = named.id
      )
    )
    SELECT matched.id AS id, matched.key AS key, matched.name AS name,
           matched.type AS type, matched.grade AS grade,
           matched.area_id AS areaId, areas.name AS areaName,
           matched.send_count AS sendCount, matched.total AS total, (
      SELECT json_group_array(json_object('id', a.id, 'name', a.name)) FROM (
        SELECT ancestor.id AS id, ancestor.name AS name
        FROM chain
        JOIN areas ancestor ON ancestor.id = chain.area_id
        WHERE chain.climb_id = matched.id AND chain.dist > 0
        ORDER BY chain.dist DESC
      ) a
    ) AS ancestors
    FROM matched
    JOIN areas ON areas.id = matched.area_id
    ORDER BY matched.key, matched.send_count DESC, matched.id
  `);

  return toCandidates(rows);
}

/** Every climb whose name matches one of `names` exactly (case-insensitive,
 * trimmed), grouped by that folded name and ordered most-ascended first
 * within each, with each climb's ancestor chain attached. One statement for
 * the whole list, for the import wizard's match step (see
 * resolveImportClimbs).
 *
 * The name filter is `LOWER(TRIM(climbs.name)) IN (...)`, which SQLite
 * satisfies from climbs_name_lower_idx (drizzle/migrations/0006); the list
 * is one json_each binding rather than a parameter per name. The window
 * functions rank and count within each name so the per-name cap and `total`
 * come out of the same pass. Ancestors are walked upward per matched climb
 * (see getAncestors) into a JSON array by an ordered subquery, as
 * searchAreas does for its ancestorPath. */
export async function findClimbCandidatesByNames(
  db: Database,
  names: readonly string[],
): Promise<ClimbCandidate[]> {
  if (names.length === 0) return [];

  const rows = await db.all<ClimbCandidateRow>(sql`
    WITH RECURSIVE wanted(key) AS (
      SELECT LOWER(TRIM(value)) FROM json_each(${JSON.stringify(names)})
    ), ranked AS (
      SELECT climbs.id, climbs.area_id, climbs.name, climbs.type, climbs.grade,
             climbs.send_count, LOWER(TRIM(climbs.name)) AS key,
             ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(climbs.name))
               ORDER BY climbs.send_count DESC, climbs.id
             ) AS rn,
             COUNT(*) OVER (PARTITION BY LOWER(TRIM(climbs.name))) AS total
      FROM climbs
      WHERE LOWER(TRIM(climbs.name)) IN (SELECT key FROM wanted)
    ), matched AS (
      SELECT * FROM ranked WHERE rn <= ${CLIMB_CANDIDATES_PER_NAME}
    ), chain(climb_id, ancestor_id, dist) AS (
      SELECT matched.id, areas.parent_id, 1
      FROM matched
      JOIN areas ON areas.id = matched.area_id
      WHERE areas.parent_id IS NOT NULL
      UNION ALL
      SELECT chain.climb_id, areas.parent_id, chain.dist + 1
      FROM chain
      JOIN areas ON areas.id = chain.ancestor_id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT matched.id AS id, matched.key AS key, matched.name AS name,
           matched.type AS type, matched.grade AS grade,
           matched.area_id AS areaId, areas.name AS areaName,
           matched.send_count AS sendCount, matched.total AS total, (
      -- json_group_array keeps the order it receives rows in, so the ORDER
      -- BY belongs on the subquery it consumes (see searchAreas).
      SELECT json_group_array(json_object('id', a.id, 'name', a.name)) FROM (
        SELECT ancestor.id AS id, ancestor.name AS name
        FROM chain
        JOIN areas ancestor ON ancestor.id = chain.ancestor_id
        WHERE chain.climb_id = matched.id
        ORDER BY chain.dist DESC
      ) a
    ) AS ancestors
    FROM matched
    JOIN areas ON areas.id = matched.area_id
    ORDER BY matched.key, matched.rn
  `);

  return toCandidates(rows);
}

export type SearchClimbsParams = DisciplineGradeFilter &
  ClimbStatsFilter & {
    name?: string;
    areaName?: string;
    sort?: SubtreeClimbsSort;
  };

export type ClimbWithAreaName = Pick<Climb, "id" | "areaId" | "name" | "type" | "grade"> & {
  areaName: string;
};

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
  pageSize = SEARCH_PAGE_SIZE,
  offset = (page - 1) * pageSize,
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
    LIMIT ${pageSize + 1}
    OFFSET ${offset}
  `);

  return {
    climbs: rows.slice(0, pageSize),
    hasNextPage: rows.length > pageSize,
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
export async function countSearchClimbs(db: Database, params: SearchClimbsParams): Promise<number> {
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
