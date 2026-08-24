import { and, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { sends, user } from "@/db/schema";
import { formatGrade, type ClimbType } from "@/lib/grades";
import type { CompletionType } from "@/lib/sends";
import { areaNameCondition } from "./areas";
import { toFtsPrefixQuery } from "./shared";
import type { Discipline } from "./climbs";

export type Send = typeof sends.$inferSelect;
export type SendWithUserName = Send & { userName: string };

/** The subset of a Send that SendForm actually needs to prefill an edit —
 * lets a flattened row (e.g. UserSendRow) be passed in without requiring
 * the full Send shape (userId/climbId/createdAt/updatedAt aren't used
 * for editing). */
export type EditableSend = Pick<
  Send,
  "id" | "completionType" | "dateSent" | "comment" | "rating" | "suggestedGrade"
>;

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

export async function getSendsForClimb(db: Database, climbId: number): Promise<SendWithUserName[]> {
  return db
    .select({ ...getTableColumns(sends), userName: user.name })
    .from(sends)
    .innerJoin(user, eq(sends.userId, user.id))
    .where(eq(sends.climbId, climbId))
    .orderBy(desc(sends.dateSent));
}

/** All climb ids the user already has a send for — cheap pre-check for bulk import, avoids one query per row just to detect duplicates. */
export async function getUserSentClimbIds(db: Database, userId: string): Promise<Set<number>> {
  const rows = await db
    .select({ climbId: sends.climbId })
    .from(sends)
    .where(eq(sends.userId, userId));
  return new Set(rows.map((r) => r.climbId));
}

// --- Paginated, filtered send history for a user's profile page ---
//
// A user's send count can run into the thousands, so (unlike the
// community-ascents list for a single climb) this is deliberately never
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
  completionType: CompletionType;
  dateSent: string | null;
  rating: number | null;
  suggestedGrade: number | null;
  comment: string | null;
};

export type UserSendsFilter = {
  disciplines: Discipline[];
  boulderRange: [number, number];
  sportRange: [number, number];
  tradRange: [number, number];
  name?: string;
  areaName?: string;
};

export const USER_SENDS_PAGE_SIZE = 10;

export type UserSendsPage = {
  sends: UserSendRow[];
  hasMore: boolean;
};

function userSendsWhere(userId: string, filter: UserSendsFilter): SQL {
  const disciplineClauses: SQL[] = [];
  if (filter.disciplines.includes("boulder")) {
    const [min, max] = filter.boulderRange;
    disciplineClauses.push(
      sql`(climbs.type = 'boulder' AND (climbs.grade IS NULL OR climbs.grade BETWEEN ${min} AND ${max}))`,
    );
  }
  if (filter.disciplines.includes("sport")) {
    const [min, max] = filter.sportRange;
    disciplineClauses.push(
      sql`(climbs.type = 'sport' AND (climbs.grade IS NULL OR climbs.grade BETWEEN ${min} AND ${max}))`,
    );
  }
  if (filter.disciplines.includes("trad")) {
    const [min, max] = filter.tradRange;
    disciplineClauses.push(
      sql`(climbs.type = 'trad' AND (climbs.grade IS NULL OR climbs.grade BETWEEN ${min} AND ${max}))`,
    );
  }
  // No discipline checked at all means the discipline/grade filter isn't
  // active — match everything, not nothing.
  const disciplineWhere =
    disciplineClauses.length > 0 ? sql`(${sql.join(disciplineClauses, sql` OR `)})` : sql`1`;

  const conditions: SQL[] = [sql`sends.user_id = ${userId}`, disciplineWhere];

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
      sends.completion_type AS completionType,
      sends.date_sent AS dateSent,
      sends.rating AS rating,
      sends.suggested_grade AS suggestedGrade,
      sends.comment AS comment
    FROM sends
    JOIN climbs ON climbs.id = sends.climb_id
    JOIN areas ON areas.id = climbs.area_id
    WHERE ${where}
    ORDER BY sends.date_sent DESC
    LIMIT ${pageSize + 1}
    OFFSET ${offset}
  `);

  const hasMore = rows.length > pageSize;
  return { sends: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
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
    return { sendCount: 0, areaCount: 0, peakGrade: null, mostLoggedDiscipline: null, latestSendDate: null };
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
    mostLoggedDiscipline: topDiscipline ? { type: topDiscipline.type, count: topDiscipline.count } : null,
    peakGrade:
      topDiscipline?.maxGrade != null ? formatGrade(topDiscipline.type, topDiscipline.maxGrade) : null,
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
  const stats: Record<number, ClimbSendStats> = {};
  for (const id of climbIds) stats[id] = { avgRating: null, sendCount: 0, avgSuggestedGrade: null };
  if (climbIds.length === 0) return stats;

  const rows = await db.all<{
    climbId: number;
    avgRating: number | null;
    sendCount: number;
    avgSuggestedGrade: number | null;
  }>(sql`
    SELECT climb_id AS climbId, AVG(rating) AS avgRating, COUNT(*) AS sendCount,
           AVG(suggested_grade) AS avgSuggestedGrade
    FROM sends
    WHERE climb_id IN (${sql.join(climbIds.map((id) => sql`${id}`), sql`, `)})
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
