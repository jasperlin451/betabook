import { and, desc, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "@/db/client";
import { sends, climbs, areas, user } from "@/db/schema";
import { formatGrade, type ClimbType } from "@/lib/grades";

export type Send = typeof sends.$inferSelect;
export type SendWithUserName = Send & { userName: string };
export type SendWithClimb = Send & {
  climbName: string;
  climbType: ClimbType;
  climbGrade: number | null;
  areaId: number;
  areaName: string;
};

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

export async function getSendsForUser(db: Database, userId: string): Promise<SendWithClimb[]> {
  return db
    .select({
      ...getTableColumns(sends),
      climbName: climbs.name,
      climbType: climbs.type,
      climbGrade: climbs.grade,
      areaId: climbs.areaId,
      areaName: areas.name,
    })
    .from(sends)
    .innerJoin(climbs, eq(sends.climbId, climbs.id))
    .innerJoin(areas, eq(climbs.areaId, areas.id))
    .where(eq(sends.userId, userId))
    .orderBy(desc(sends.dateSent));
}

export type UserStatsSummary = {
  sendCount: number;
  areaCount: number;
  peakGrade: string | null;
  mostLoggedDiscipline: { type: ClimbType; count: number } | null;
  latestSendDate: string | null;
};

/** Peak grade is scoped to the user's most-logged discipline — grades aren't
 * comparable across boulder/sport/trad, so picking a single cross-discipline
 * "best" would be misleading. Pure function operating on sends already
 * fetched by the caller (e.g. via getSendsForUser) — no separate query. */
export function summarizeUserSends(userSends: SendWithClimb[]): UserStatsSummary {
  if (userSends.length === 0) {
    return {
      sendCount: 0,
      areaCount: 0,
      peakGrade: null,
      mostLoggedDiscipline: null,
      latestSendDate: null,
    };
  }

  const countByType = new Map<ClimbType, number>();
  for (const send of userSends) {
    countByType.set(send.climbType, (countByType.get(send.climbType) ?? 0) + 1);
  }
  const [mostLoggedType, mostLoggedCount] = [...countByType.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  const peakGradeOrdinal = userSends
    .filter((send) => send.climbType === mostLoggedType)
    .map((send) => send.climbGrade)
    .filter((grade): grade is number => grade != null)
    .reduce((max, grade) => Math.max(max, grade), -Infinity);

  return {
    sendCount: userSends.length,
    areaCount: new Set(userSends.map((send) => send.areaId)).size,
    peakGrade:
      peakGradeOrdinal === -Infinity ? null : formatGrade(mostLoggedType, peakGradeOrdinal),
    mostLoggedDiscipline: { type: mostLoggedType, count: mostLoggedCount },
    latestSendDate: userSends.find((send) => send.dateSent != null)?.dateSent ?? null,
  };
}
