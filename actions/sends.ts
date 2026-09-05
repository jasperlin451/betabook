"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { journalEntries, sends } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { allowJournalWrite } from "@/lib/rate-limit";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import { requireSession } from "@/lib/session";
import { pickFormFields } from "@/lib/validation";

import {
  assertAscentDateChange,
  buildSentJournalInsert,
  getSentJournalEntries,
  journalEntryFromSend,
  rethrowJournalSendInvariant,
} from "./journal-sync";
import { revalidateJournalSurfaces, revalidateSendSurfaces } from "./revalidation";
import { buildMirroredSendUpdate, buildSendInsert } from "./send-statements";

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

export async function createUndatedSend(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireSession();
    if (!(await allowJournalWrite(session.user.id))) {
      throw new ActionError(
        "You're logging entries faster than we can save them — give it a minute",
      );
    }
    const climbId = Number(formData.get("climbId"));
    if (!Number.isInteger(climbId) || climbId < 1) throw new ActionError("Invalid climb");
    const db = await getDb();
    const climb = await getClimb(db, climbId);
    if (!climb) throw new ActionError("Climb not found");
    if (await getUserSendForClimb(db, session.user.id, climbId)) {
      throw new ActionError("You've already logged this climb — use Edit send to change it");
    }
    const input = validateSendInput(climb.type, readSendFormData(formData));
    if (input.dateSent !== null) throw new ActionError("Use the journal to log a dated send");
    await buildSendInsert(db, { userId: session.user.id, climbId, climbType: climb.type, input });
    revalidateSendSurfaces({
      userIds: [session.user.id],
      climbIds: [climbId],
      areaIds: [climb.areaId],
    });
    revalidateJournalSurfaces({ userId: session.user.id, climbIds: [climbId] });
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
    const sentEntries = await getSentJournalEntries(db, session.user.id, [existing.climbId]);
    const ascent = sentEntries.find((entry) => entry.isAscent);
    const sendStatement = buildMirroredSendUpdate(db, {
      userId: session.user.id,
      climbId: existing.climbId,
      sendId,
      values: input,
      ascentEntryId: ascent?.id ?? null,
    });

    if (ascent && !input.dateSent) {
      throw new ActionError("A send with journal history must keep its date");
    }

    if (input.dateSent) {
      assertAscentDateChange(sentEntries, input.dateSent);
      const journalStatement = ascent
        ? db
            .update(journalEntries)
            .set({ entryDate: input.dateSent, body: input.comment })
            .where(eq(journalEntries.id, ascent.id))
        : buildSentJournalInsert(
            db,
            journalEntryFromSend(session.user.id, existing.climbId, input.dateSent, input.comment),
          );
      try {
        await db.batch(
          ascent ? [journalStatement, sendStatement] : [sendStatement, journalStatement],
        );
      } catch (error) {
        rethrowJournalSendInvariant(
          error,
          "The journal changed while this send was being saved — try again",
        );
      }
      revalidateJournalSurfaces({ userId: session.user.id, climbIds: [existing.climbId] });
    } else {
      await sendStatement;
    }

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
    revalidateJournalSurfaces({ userId: session.user.id, climbIds: [existing.climbId] });
    revalidateSendSurfaces({
      userIds: [session.user.id],
      climbIds: [existing.climbId],
      areaIds: climb ? [climb.areaId] : [],
    });
    refresh();
  });
}
