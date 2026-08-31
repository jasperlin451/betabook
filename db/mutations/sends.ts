"use server";

import { refresh } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { pickFormFields } from "@/lib/validation";
import { revalidateSendSurfaces } from "./revalidation";

const SEND_FORM_FIELDS = [
  "ascentStyle",
  "dateSent",
  "comment",
  "rating",
  "suggestedGrade",
  "gradeFeel",
] as const;

function readSendFormData(formData: FormData): RawSendInput {
  return pickFormFields(formData, SEND_FORM_FIELDS);
}

export async function createSend(climbId: number, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const climb = await getClimb(db, climbId);
    if (!climb) throw new ActionError("Climb not found");

    const existing = await getUserSendForClimb(db, session.user.id, climbId);
    if (existing) {
      throw new ActionError("You've already sent this climb — edit your existing send instead.");
    }

    const input = validateSendInput(climb.type, readSendFormData(formData));
    // climbs.sendCount/ratingSum/ratingCount (denormalized for
    // getSubtreeClimbs's sort — see drizzle/schema/climbs.ts) are maintained
    // by triggers on sends, so this is a plain single-statement write.
    const inserted = await db.all<{ id: number }>(sql`
      INSERT INTO sends (
        user_id, climb_id, ascent_style, date_sent, comment, rating,
        suggested_grade, grade_feel
      )
      SELECT ${session.user.id}, climbs.id, ${input.ascentStyle},
             ${input.dateSent}, ${input.comment}, ${input.rating},
             ${input.suggestedGrade}, ${input.gradeFeel}
      FROM climbs
      WHERE climbs.id = ${climbId} AND climbs.type = ${climb.type}
      RETURNING id
    `);
    if (inserted.length === 0) {
      throw new ActionError("Climb changed while this send was being saved — try again");
    }

    revalidateSendSurfaces({
      userIds: [session.user.id],
      climbIds: [climbId],
      areaIds: [climb.areaId],
    });
    refresh();
  });
}

export async function updateSend(sendId: number, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    if (!existing || existing.userId !== session.user.id) throw new ActionError("Send not found");

    const climb = await getClimb(db, existing.climbId);
    if (!climb) throw new ActionError("Climb not found");

    const input = validateSendInput(climb.type, readSendFormData(formData));

    // The climbs aggregates follow this write via trigger — including a
    // rating moving to or from null, which the trigger handles as a full
    // remove-then-add.
    await db.update(sends).set(input).where(eq(sends.id, sendId));

    revalidateSendSurfaces({
      userIds: [session.user.id],
      climbIds: [existing.climbId],
      areaIds: [climb.areaId],
    });
    refresh();
  });
}

export async function deleteSend(sendId: number): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    if (!existing || existing.userId !== session.user.id) throw new ActionError("Send not found");

    await db.delete(sends).where(eq(sends.id, sendId));

    const climb = await getClimb(db, existing.climbId);
    revalidateSendSurfaces({
      userIds: [session.user.id],
      climbIds: [existing.climbId],
      areaIds: climb ? [climb.areaId] : [],
    });
    refresh();
  });
}
