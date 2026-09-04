import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { areas, climbs, sends, user } from "@/db/schema";
import {
  DEFAULT_BOULDER_RANGE,
  DEFAULT_SPORT_RANGE,
  DEFAULT_TRAD_RANGE,
  type DisciplineFilter,
} from "@/lib/discipline-filter";
import { formatGrade, type ClimbType } from "@/lib/grades";
import { ASCENT_STYLES, GRADE_FEEL_OFFSET, type AscentStyle, type GradeFeel } from "@/lib/sends";

import { areaNameCondition } from "./areas";
import type { Climb, Discipline } from "./climbs";
import { toFtsPrefixQuery } from "./shared";

export type Send = typeof sends.$inferSelect;

/** The subset of a Send that SendForm actually needs to prefill an edit —
 * lets a flattened row (e.g. UserSendRow) be passed in without requiring
 * the full Send shape (userId/climbId/createdAt/updatedAt aren't used
 * for editing). */
export type EditableSend = Pick<
  Send,
  "id" | "ascentStyle" | "dateSent" | "comment" | "rating" | "suggestedGrade" | "gradeFeel"
>;

/** The subset of a Climb the create/edit-send chain (SendActionsMenu ->
 * SendFormDrawer -> SendForm) actually reads — same "narrow to what's
 * used" reasoning as EditableSend, so a flattened row (e.g. UserSendRow)
 * can build one honestly instead of fabricating the rest of Climb's
 * denormalized fields. */
export type SendableClimb = Pick<Climb, "id" | "areaId" | "type" | "grade">;

export async function getUserSendForClimb(
  db: Database,
  userId: string,
  climbId: number,
): Promise<Send | undefined> {
  return db
    .select()
    .from(sends)
    .where(and(eq(sends.userId, userId), eq(sends.climbId, climbId)))
    .get();
}

/** One community-ascents row for the climb detail page: the fields the list
 * renders plus what the edit flow needs (EditableSend), and nothing else —
 * notably not createdAt/updatedAt, which are Date columns that would silently
 * degrade to strings across the /api/climbs/[id]/sends JSON boundary. */
export type ClimbSendRow = EditableSend & { userId: string; userName: string };

export const CLIMB_SENDS_PAGE_SIZE = 10;

export type ClimbSendsPage = { sends: ClimbSendRow[]; hasMore: boolean };

/** A page of a climb's send history, newest dateSent first (NULL dates last,
 * SQLite's DESC default) with `sends.id` as the deterministic tie-breaker —
 * sends sharing a date have no defined order without it, so OFFSET
 * pagination could duplicate or skip them across pages. A popular climb can
 * have hundreds of sends, so this is never fetched in full: the first page
 * is server-rendered and /api/climbs/[id]/sends backs "load more".
 *
 * `viewerId` excludes rows belonging to a private user other than the viewer
 * themselves (see lib/user-visibility.ts) — this is the one query in the
 * module that lists sends across many authors, so it's the one place a
 * per-row visibility check is needed. The climb's send_count/rating/suggested
 * grade are unaffected: those come from getClimbSendStats/the aggregate
 * triggers, neither of which joins `user`. */
export async function getSendsForClimb(
  db: Database,
  climbId: number,
  offset = 0,
  pageSize: number = CLIMB_SENDS_PAGE_SIZE,
  viewerId: string | null = null,
): Promise<ClimbSendsPage> {
  const visibilityCondition = viewerId
    ? sql`(user.is_private = 0 OR sends.user_id = ${viewerId})`
    : sql`user.is_private = 0`;

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db
    .select({
      id: sends.id,
      userId: sends.userId,
      userName: user.name,
      ascentStyle: sends.ascentStyle,
      dateSent: sends.dateSent,
      comment: sends.comment,
      rating: sends.rating,
      suggestedGrade: sends.suggestedGrade,
      gradeFeel: sends.gradeFeel,
    })
    .from(sends)
    .innerJoin(user, eq(sends.userId, user.id))
    .where(and(eq(sends.climbId, climbId), visibilityCondition))
    .orderBy(desc(sends.dateSent), asc(sends.id))
    .limit(pageSize + 1)
    .offset(offset);

  const hasMore = rows.length > pageSize;
  return { sends: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
}

export type SuggestedGradeCount = { grade: number; feel: GradeFeel; count: number };

export type ClimbSendSummary = ClimbSendStats & {
  styleBreakdown: Record<AscentStyle, number>;
  /** How many senders suggested each grade — the community's own grading
   * of the climb, for the logged-grades histogram. */
  suggestedGradeCounts: SuggestedGradeCount[];
};

/** Whole-history stats for the climb detail page's stat cards — aggregate
 * SQL over every send, independent of the paginated list (which no longer
 * loads the full history to reduce in memory). */
export async function getClimbSendSummary(
  db: Database,
  climbId: number,
): Promise<ClimbSendSummary> {
  const styleBreakdown = Object.fromEntries(ASCENT_STYLES.map((style) => [style, 0])) as Record<
    AscentStyle,
    number
  >;

  const [stats, styleRows, suggestedGradeCounts] = await Promise.all([
    getClimbSendStats(db, [climbId]),
    db.all<{ ascentStyle: AscentStyle; count: number }>(sql`
      SELECT ascent_style AS ascentStyle, COUNT(*) AS count
      FROM sends
      WHERE climb_id = ${climbId}
      GROUP BY ascent_style
    `),
    db.all<SuggestedGradeCount>(sql`
      SELECT suggested_grade AS grade, grade_feel AS feel, COUNT(*) AS count
      FROM sends
      WHERE climb_id = ${climbId} AND suggested_grade IS NOT NULL
      GROUP BY suggested_grade, grade_feel
    `),
  ]);
  for (const row of styleRows) {
    styleBreakdown[row.ascentStyle] = row.count;
  }

  return { ...stats[climbId], styleBreakdown, suggestedGradeCounts };
}

/** Climb ids the user already has a send for. Pass `climbIds` on list pages
 * so the query and RSC payload stay proportional to the visible page; omit
 * it only for workflows that genuinely need the whole set (the profile
 * picker and import duplicate pre-check). */
export async function getUserSentClimbIds(
  db: Database,
  userId: string,
  climbIds?: readonly number[],
): Promise<Set<number>> {
  const distinctIds = climbIds ? [...new Set(climbIds)] : undefined;
  if (distinctIds?.length === 0) return new Set();

  // The ids go over as one JSON binding rather than one parameter each, so a
  // future caller cannot accidentally exceed D1's 100-parameter ceiling.
  // Same reasoning as getAreaBreadcrumbs.
  const rows = await db.all<{ climbId: number }>(sql`
    SELECT sends.climb_id AS climbId
    FROM sends
    WHERE sends.user_id = ${userId}
    ${
      distinctIds
        ? sql`AND sends.climb_id IN (
            SELECT CAST(value AS INTEGER) FROM json_each(${JSON.stringify(distinctIds)})
          )`
        : sql``
    }
  `);
  return new Set(rows.map((r) => r.climbId));
}

// --- Paginated, filtered send history for a user's profile page ---
//
// A user's send count can run into the thousands, so (like the
// community-ascents list for a single climb above) this is deliberately never
// fetched in full: both the row query and the summary stats below are
// bounded/aggregate SQL, not "fetch everything and reduce in memory".

export type UserSendRow = {
  id: number;
  climbId: number;
  climbName: string;
  climbType: ClimbType;
  climbGrade: number | null;
  areaId: number;
  areaName: string;
  ascentStyle: AscentStyle;
  dateSent: string | null;
  rating: number | null;
  suggestedGrade: number | null;
  gradeFeel: GradeFeel;
  comment: string | null;
};

export type UserSendsSort =
  | "date_desc"
  | "date_asc"
  | "grade_desc"
  | "grade_asc"
  | "rating_desc"
  | "rating_asc";

export type UserSendsFilter = DisciplineFilter & {
  name?: string;
  areaName?: string;
  sort?: UserSendsSort;
  ascentStyles: AscentStyle[];
  minRating: number;
};

// NULLS LAST on the ascending variants keeps unknown-date/unknown-grade
// sends at the bottom regardless of direction — SQLite otherwise treats
// NULL as the smallest value, which would float them to the top of an ASC
// sort. The descending variants already put NULLs last by default.
//
// None of these keys is unique, so getSendsForUserPage appends `sends.id`
// as a final tie-breaker (same as getSubtreeClimbs's `climbs.id`) — without
// it, rows sharing a value have no defined order, and OFFSET pagination can
// duplicate or skip them across pages.
const USER_SENDS_ORDER_BY: Record<UserSendsSort, SQL> = {
  date_desc: sql`sends.date_sent DESC`,
  date_asc: sql`sends.date_sent ASC NULLS LAST`,
  grade_desc: sql`climbs.grade DESC`,
  grade_asc: sql`climbs.grade ASC NULLS LAST`,
  rating_desc: sql`sends.rating DESC`,
  rating_asc: sql`sends.rating ASC NULLS LAST`,
};

export const USER_SENDS_PAGE_SIZE = 10;

export type UserSendsPage = {
  sends: UserSendRow[];
  hasMore: boolean;
};

/** One checked discipline's clause. At the full default range the grade
 * filter isn't narrowed at all, so there's no grade predicate and
 * grade-unknown (NULL) sends are included; once either bound is narrowed,
 * NULL grades fail the BETWEEN and are excluded — an unknown grade can't be
 * known to fall inside a narrowed range. (They used to be OR-ed back in, so
 * "grade unknown" sends matched every narrowed range.) */
function disciplineGradeClause(
  type: Discipline,
  range: [number, number],
  fullRange: [number, number],
): SQL {
  const [min, max] = range;
  if (min <= fullRange[0] && max >= fullRange[1]) return sql`climbs.type = ${type}`;
  return sql`(climbs.type = ${type} AND climbs.grade BETWEEN ${min} AND ${max})`;
}

function userSendsWhere(userId: string, filter: UserSendsFilter): SQL {
  const disciplineClauses: SQL[] = [];
  if (filter.disciplines.includes("boulder")) {
    disciplineClauses.push(
      disciplineGradeClause("boulder", filter.boulderRange, DEFAULT_BOULDER_RANGE),
    );
  }
  if (filter.disciplines.includes("sport")) {
    disciplineClauses.push(disciplineGradeClause("sport", filter.sportRange, DEFAULT_SPORT_RANGE));
  }
  if (filter.disciplines.includes("trad")) {
    disciplineClauses.push(disciplineGradeClause("trad", filter.tradRange, DEFAULT_TRAD_RANGE));
  }
  // No discipline checked at all means the discipline/grade filter isn't
  // active — match everything, not nothing.
  const disciplineWhere =
    disciplineClauses.length > 0 ? sql`(${sql.join(disciplineClauses, sql` OR `)})` : sql`1`;

  const conditions: SQL[] = [sql`sends.user_id = ${userId}`, disciplineWhere];

  if (filter.ascentStyles.length > 0) {
    conditions.push(
      sql`sends.ascent_style IN (${sql.join(
        filter.ascentStyles.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }

  // A null rating naturally fails this once a minimum is actually set — no
  // special-case NULL handling needed.
  if (filter.minRating > 0) {
    conditions.push(sql`sends.rating >= ${filter.minRating}`);
  }

  if (filter.name) {
    const nameQuery = toFtsPrefixQuery(filter.name);
    conditions.push(
      nameQuery
        ? sql`sends.climb_id IN (SELECT rowid FROM climbs_fts WHERE climbs_fts MATCH ${nameQuery})`
        : sql`0`,
    );
  }

  const areaCondition = areaNameCondition(filter.areaName);
  if (areaCondition) conditions.push(areaCondition);

  return sql.join(conditions, sql` AND `);
}

export async function getSendsForUserPage(
  db: Database,
  userId: string,
  filter: UserSendsFilter,
  offset: number,
  pageSize: number = USER_SENDS_PAGE_SIZE,
): Promise<UserSendsPage> {
  const where = userSendsWhere(userId, filter);

  // Fetch one extra row to detect a next page without a separate COUNT query.
  const rows = await db.all<UserSendRow>(sql`
    SELECT
      sends.id AS id,
      sends.climb_id AS climbId,
      climbs.name AS climbName,
      climbs.type AS climbType,
      climbs.grade AS climbGrade,
      climbs.area_id AS areaId,
      areas.name AS areaName,
      sends.ascent_style AS ascentStyle,
      sends.date_sent AS dateSent,
      sends.rating AS rating,
      sends.suggested_grade AS suggestedGrade,
      sends.grade_feel AS gradeFeel,
      sends.comment AS comment
    FROM sends
    JOIN climbs ON climbs.id = sends.climb_id
    JOIN areas ON areas.id = climbs.area_id
    WHERE ${where}
    ORDER BY ${USER_SENDS_ORDER_BY[filter.sort ?? "date_desc"]}, sends.id
    LIMIT ${pageSize + 1}
    OFFSET ${offset}
  `);

  const hasMore = rows.length > pageSize;
  return { sends: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
}

const EXPORT_SENDS_PAGE_SIZE = 200;
export type UserSendsExportCursor = { dateSent: string | null; id: number };
export type UserSendsExportPage = {
  sends: UserSendRow[];
  nextCursor: UserSendsExportCursor | null;
};

/** Full-history export uses keyset pagination rather than the UI list's
 * bounded OFFSET. It therefore never replays/clamps at 10k rows and each
 * request seeks from the previous `(date_sent, id)` key through
 * sends_user_date_idx. Dated and undated sends are fetched as separate index
 * ranges: combining them with OR prevents SQLite from seeking past user_id
 * and turns page N into a rescan of pages 1…N-1. */
export async function getSendsForUserExportPage(
  db: Database,
  userId: string,
  cursor: UserSendsExportCursor | null,
): Promise<UserSendsExportPage> {
  const rows: UserSendRow[] = [];

  // Phase 1: dated rows. Matching DESC directions let the row-value range
  // map directly to the (user_id, date_sent DESC, id DESC) index.
  if (cursor === null || cursor.dateSent !== null) {
    const datedRange =
      cursor === null
        ? sql`sends.date_sent IS NOT NULL`
        : sql`sends.date_sent IS NOT NULL
              AND (sends.date_sent, sends.id) < (${cursor.dateSent}, ${cursor.id})`;
    rows.push(...(await getUserExportRows(db, userId, datedRange, EXPORT_SENDS_PAGE_SIZE + 1)));
  }

  // Phase 2: NULL dates sort after every dated row. Only enter this range
  // once the dated range no longer fills the page; when a page straddles the
  // boundary, fetch just enough NULL rows to fill it plus the has-more row.
  if (rows.length <= EXPORT_SENDS_PAGE_SIZE) {
    const undatedRange =
      cursor?.dateSent === null
        ? sql`sends.date_sent IS NULL AND sends.id < ${cursor.id}`
        : sql`sends.date_sent IS NULL`;
    rows.push(
      ...(await getUserExportRows(
        db,
        userId,
        undatedRange,
        EXPORT_SENDS_PAGE_SIZE + 1 - rows.length,
      )),
    );
  }

  const hasMore = rows.length > EXPORT_SENDS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, EXPORT_SENDS_PAGE_SIZE) : rows;
  const last = page.at(-1);
  return {
    sends: page,
    nextCursor: hasMore && last ? { dateSent: last.dateSent, id: last.id } : null,
  };
}

function getUserExportRows(
  db: Database,
  userId: string,
  range: SQL,
  limit: number,
): Promise<UserSendRow[]> {
  return db.all<UserSendRow>(sql`
    SELECT
      sends.id AS id,
      sends.climb_id AS climbId,
      climbs.name AS climbName,
      climbs.type AS climbType,
      climbs.grade AS climbGrade,
      climbs.area_id AS areaId,
      areas.name AS areaName,
      sends.ascent_style AS ascentStyle,
      sends.date_sent AS dateSent,
      sends.rating AS rating,
      sends.suggested_grade AS suggestedGrade,
      sends.grade_feel AS gradeFeel,
      sends.comment AS comment
    FROM sends INDEXED BY sends_user_date_idx
    JOIN climbs ON climbs.id = sends.climb_id
    JOIN areas ON areas.id = climbs.area_id
    WHERE sends.user_id = ${userId} AND (${range})
    ORDER BY sends.date_sent DESC, sends.id DESC
    LIMIT ${limit}
  `);
}

export type UserStatsSummary = {
  sendCount: number;
  areaCount: number;
  peakGrade: string | null;
  mostLoggedDiscipline: { type: ClimbType; count: number } | null;
  latestSendDate: string | null;
};

type UserSendsTotals = { sendCount: number; areaCount: number; latestSendDate: string | null };
type TopDiscipline = { type: ClimbType; count: number; maxGrade: number | null };

/** Peak grade is scoped to the user's most-logged discipline — grades aren't
 * comparable across boulder/sport/trad, so picking a single cross-discipline
 * "best" would be misleading. Two small aggregate queries over the whole
 * history (independent of any list filter/pagination), not a full row fetch. */
export async function getUserSendsSummary(db: Database, userId: string): Promise<UserStatsSummary> {
  const [totals] = await db.all<UserSendsTotals>(sql`
    SELECT
      COUNT(*) AS sendCount,
      COUNT(DISTINCT climbs.area_id) AS areaCount,
      MAX(sends.date_sent) AS latestSendDate
    FROM sends
    JOIN climbs ON climbs.id = sends.climb_id
    WHERE sends.user_id = ${userId}
  `);

  if (!totals || totals.sendCount === 0) {
    return {
      sendCount: 0,
      areaCount: 0,
      peakGrade: null,
      mostLoggedDiscipline: null,
      latestSendDate: null,
    };
  }

  const [topDiscipline] = await db.all<TopDiscipline>(sql`
    SELECT climbs.type AS type, COUNT(*) AS count, MAX(climbs.grade) AS maxGrade
    FROM sends
    JOIN climbs ON climbs.id = sends.climb_id
    WHERE sends.user_id = ${userId}
    GROUP BY climbs.type
    ORDER BY count DESC
    LIMIT 1
  `);

  return {
    sendCount: totals.sendCount,
    areaCount: totals.areaCount,
    latestSendDate: totals.latestSendDate,
    mostLoggedDiscipline: topDiscipline
      ? { type: topDiscipline.type, count: topDiscipline.count }
      : null,
    peakGrade:
      topDiscipline?.maxGrade != null
        ? formatGrade(topDiscipline.type, topDiscipline.maxGrade)
        : null,
  };
}

export type ClimbSendStats = {
  avgRating: number | null;
  sendCount: number;
  avgSuggestedGrade: number | null;
};

/** One batched lookup for a page of search results, not one query per climb.
 * Climbs with zero sends are pre-seeded to the zero/null default rather than
 * omitted, since a GROUP BY simply has no row for them. */
export async function getClimbSendStats(
  db: Database,
  climbIds: number[],
): Promise<Record<number, ClimbSendStats>> {
  const distinctIds = [...new Set(climbIds)];
  const stats: Record<number, ClimbSendStats> = {};
  for (const id of distinctIds) {
    stats[id] = { avgRating: null, sendCount: 0, avgSuggestedGrade: null };
  }
  if (distinctIds.length === 0) return stats;

  const rows = await db.all<{
    climbId: number;
    avgRating: number | null;
    sendCount: number;
    avgSuggestedGrade: number | null;
  }>(sql`
    SELECT climb_id AS climbId, AVG(rating) AS avgRating, COUNT(*) AS sendCount,
           AVG(suggested_grade + CASE grade_feel
                 WHEN 'low' THEN ${GRADE_FEEL_OFFSET.low}
                 WHEN 'high' THEN ${GRADE_FEEL_OFFSET.high}
                 ELSE 0 END) AS avgSuggestedGrade
    FROM sends
    WHERE climb_id IN (
      SELECT CAST(value AS INTEGER) FROM json_each(${JSON.stringify(distinctIds)})
    )
    GROUP BY climb_id
  `);
  for (const row of rows) {
    stats[row.climbId] = {
      avgRating: row.avgRating,
      sendCount: row.sendCount,
      avgSuggestedGrade: row.avgSuggestedGrade,
    };
  }
  return stats;
}

export type AnalyticsSendRow = {
  climbId: number;
  climbName: string;
  climbType: ClimbType;
  /** The climber's own grade. climbs.grade is deliberately absent: analytics
   * reads one grade source so no chart's ceiling contradicts another's. */
  suggestedGrade: number | null;
  areaId: number;
  areaName: string;
  ascentStyle: AscentStyle;
  dateSent: string | null;
};

/** Every send a user has logged, with just the fields the analytics page
 * aggregates. One query, oldest climb-date first; all the derivation lives
 * in lib/user-analytics.ts where it's pure and testable. A user's log tops
 * out in the low thousands of rows — fine for a single D1 round trip, and
 * the page is per-user, not per-request-hot. */
export async function getUserSendsForAnalytics(
  db: Database,
  userId: string,
): Promise<AnalyticsSendRow[]> {
  return db
    .select({
      climbId: sends.climbId,
      climbName: climbs.name,
      climbType: climbs.type,
      suggestedGrade: sends.suggestedGrade,
      areaId: climbs.areaId,
      areaName: areas.name,
      ascentStyle: sends.ascentStyle,
      dateSent: sends.dateSent,
    })
    .from(sends)
    .innerJoin(climbs, eq(sends.climbId, climbs.id))
    .innerJoin(areas, eq(climbs.areaId, areas.id))
    .where(eq(sends.userId, userId))
    .orderBy(sends.dateSent, sends.id);
}
