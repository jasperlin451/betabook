"use server";

import { sql } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import { goalCountSql } from "@/db/queries/goals";
import { goals, goalPeriods } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import {
  goalInputSchema,
  goalToday,
  goalWindow,
  MAX_ACTIVE_GOALS,
  type GoalInput,
} from "@/lib/goals";
import { allowJournalWrite } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

import { revalidateJournalSurfaces } from "./revalidation";

function validateGoalId(id: number | null) {
  if (id !== null && (!Number.isSafeInteger(id) || id < 1))
    throw new ActionError("Goal not found.");
}

function historyCutoff(
  existing:
    | { repeat: "none" | "week" | "month"; timezone: string; endDate: string }
    | null
    | undefined,
  fallback: string,
) {
  return existing && existing.repeat !== "none"
    ? goalWindow(existing.repeat, goalToday(existing.timezone), existing.endDate).startDate
    : fallback;
}

function completedInputSql(
  input: GoalInput,
  window: { startDate: string; endDate: string },
  ownerId: string,
) {
  return input.repeat === "none"
    ? sql`(SELECT ${goalCountSql()} >= ${input.target} FROM (SELECT ${ownerId} AS user_id,${input.kind} AS kind,${input.discipline} AS discipline,${input.grade} AS grade,${input.gradeMatch} AS grade_match,${window.startDate} AS start_date,${window.endDate} AS end_date) g)`
    : sql`0`;
}

export async function saveGoal(id: number | null, raw: unknown): Promise<ActionResult<number>> {
  return toActionResult(async () => {
    const session = await requireSession();
    if (!(await allowJournalWrite(session.user.id)))
      throw new ActionError("Please wait before changing another goal.");
    validateGoalId(id);
    const parsed = goalInputSchema.safeParse(raw);
    if (!parsed.success)
      throw new ActionError(parsed.error.issues[0]?.message ?? "Check your goal fields.");
    const input = parsed.data;
    const ownerId = session.user.id;
    const db = await getDb();
    const existing =
      id === null
        ? null
        : await db.get<{
            startDate: string;
            endDate: string;
            timeframe: string;
            repeat: "none" | "week" | "month";
            timezone: string;
          }>(
            sql`SELECT start_date AS startDate,end_date AS endDate,timeframe,repeat,timezone FROM goals WHERE id = ${id} AND user_id = ${ownerId}`,
          );
    if (id !== null && !existing) throw new ActionError("Goal not found.");
    const period = input.repeat === "none" ? input.timeframe : input.repeat;
    const window =
      existing &&
      existing.repeat === "none" &&
      existing.timeframe === input.timeframe &&
      existing.repeat === input.repeat &&
      period !== "custom"
        ? { startDate: existing.startDate, endDate: existing.endDate }
        : goalWindow(
            period,
            goalToday(input.timezone),
            input.endDate,
            input.startDate ?? existing?.startDate,
          );
    if (input.kind === "grade") {
      const prior = await db.get(
        sql`SELECT 1 FROM sends s JOIN climbs c ON c.id = s.climb_id WHERE s.user_id = ${ownerId} AND c.type = ${input.discipline} AND c.grade >= ${input.grade} AND (s.date_sent IS NULL OR s.date_sent < ${window.startDate}) LIMIT 1`,
      );
      if (prior)
        throw new ActionError(
          "You’ve already sent this grade. Choose a new grade or a volume goal.",
        );
    }
    const otherActive = sql`(SELECT count(*) FROM goals g WHERE g.user_id = ${ownerId} AND (${id} IS NULL OR g.id <> ${id}) AND (g.repeat <> 'none' OR ${goalCountSql()} < g.target))`;
    const alreadyActive = sql`EXISTS(SELECT 1 FROM goals g WHERE g.id=${id} AND g.user_id=${ownerId} AND (g.repeat <> 'none' OR ${goalCountSql()} < g.target))`;
    const remainsCompleted = completedInputSql(input, window, ownerId);
    const capacity = sql`(${otherActive} < ${MAX_ACTIVE_GOALS} OR ${alreadyActive} OR ${remainsCompleted})`;
    const update = db
      .update(goals)
      .set({
        kind: input.kind,
        target: input.target,
        discipline: input.discipline,
        grade: input.grade,
        gradeMatch: input.gradeMatch,
        timeframe: input.timeframe,
        repeat: input.repeat,
        startDate: window.startDate,
        endDate: window.endDate,
        timezone: input.timezone,
      })
      .where(sql`id=${id} AND user_id=${ownerId} AND ${capacity}`)
      .returning({ id: goals.id });
    const cutoff = historyCutoff(existing, window.startDate);
    const snapshot = sql`WITH RECURSIVE past AS (
        SELECT id,user_id,start_date AS ps,end_date AS pe,target,repeat,timezone FROM goals WHERE id=${id} AND user_id=${ownerId} AND repeat <> 'none'
        UNION ALL SELECT id,user_id,date(pe,'+1 day'),CASE repeat WHEN 'week' THEN date(pe,'+7 days') ELSE date(pe,'+1 day','+1 month','-1 day') END,target,repeat,timezone FROM past WHERE pe < ${cutoff}
      ) SELECT id,ps,pe,target,repeat,timezone FROM past WHERE pe < ${cutoff} AND ${capacity}`;
    const result =
      id === null
        ? await db.get<{
            id: number;
          }>(sql`INSERT INTO goals (user_id,kind,target,discipline,grade,timeframe,repeat,start_date,end_date,timezone,grade_match)
          SELECT ${ownerId},${input.kind},${input.target},${input.discipline},${input.grade},${input.timeframe},${input.repeat},${window.startDate},${window.endDate},${input.timezone},${input.gradeMatch}
          WHERE ${capacity} RETURNING id`)
        : (
            await db.batch([db.insert(goalPeriods).select(snapshot).onConflictDoNothing(), update])
          )[1][0];
    if (!result)
      throw new ActionError("You can have up to 5 active goals. Delete a goal to make room.");
    revalidateJournalSurfaces({ userId: ownerId, climbIds: [] });
    refresh();
    return result.id;
  });
}

export async function deleteGoal(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    if (!Number.isSafeInteger(id) || id < 1) throw new ActionError("Goal not found.");
    const db = await getDb();
    const result = await db.get(
      sql`DELETE FROM goals WHERE id = ${id} AND user_id = ${session.user.id} RETURNING id`,
    );
    if (!result) throw new ActionError("Goal not found.");
    revalidateJournalSurfaces({ userId: session.user.id, climbIds: [] });
    refresh();
  });
}
