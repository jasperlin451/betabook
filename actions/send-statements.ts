import { sql } from "drizzle-orm";

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
