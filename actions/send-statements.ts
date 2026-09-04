import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { sends } from "@/db/schema";
import type { ClimbType } from "@/lib/grades";
import type { SendInput } from "@/lib/sends";

const CLIMB_GUARD_ERROR = "NOT NULL constraint failed: sends.climb_id";

export function isSendClimbGuardFailure(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes(CLIMB_GUARD_ERROR)) return true;
  }
  return false;
}

export function buildSendInsert(
  db: Database,
  {
    userId,
    climbId,
    climbType,
    input,
  }: { userId: string; climbId: number; climbType: ClimbType; input: SendInput },
) {
  return db
    .insert(sends)
    .values({
      userId,
      climbId: sql`(SELECT c.id FROM climbs c WHERE c.id = ${climbId} AND c.type = ${climbType})`,
      ascentStyle: input.ascentStyle,
      dateSent: input.dateSent,
      comment: input.comment,
      rating: input.rating,
      suggestedGrade: input.suggestedGrade,
      gradeFeel: input.gradeFeel,
    })
    .returning({ id: sends.id });
}

type SendUpdateValues = Partial<typeof sends.$inferInsert> & {
  dateSent: string | null;
  comment: string | null;
};

export function buildMirroredSendUpdate(
  db: Database,
  {
    userId,
    climbId,
    sendId,
    values,
    ascentEntryId,
  }: {
    userId: string;
    climbId: number;
    sendId?: number;
    values: SendUpdateValues;
    ascentEntryId: number | null;
  },
) {
  const mirrorGuard =
    ascentEntryId === null
      ? sql`NOT EXISTS (
          SELECT 1 FROM journal_entries j
          WHERE j.user_id = ${userId} AND j.climb_id = ${climbId} AND j.sent = 1
        )`
      : sql`${values.dateSent} IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM journal_entries j
          WHERE j.user_id = ${userId}
            AND j.climb_id = ${climbId}
            AND j.sent = 1
            AND j.id <> ${ascentEntryId}
            AND (
              j.entry_date < ${values.dateSent}
              OR (j.entry_date = ${values.dateSent} AND j.id < ${ascentEntryId})
            )
        )`;
  const identity = [eq(sends.userId, userId), eq(sends.climbId, climbId)];
  if (sendId !== undefined) identity.push(eq(sends.id, sendId));

  return db
    .update(sends)
    .set({
      ...values,
      userId: sql`(
        SELECT s.user_id
        FROM sends s
        WHERE s.user_id = ${userId} AND s.climb_id = ${climbId} AND ${mirrorGuard}
      )`,
    })
    .where(and(...identity));
}
