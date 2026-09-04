"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { journalEntries, sends } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
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
import {
  buildMirroredSendUpdate,
  buildSendInsert,
  isSendClimbGuardFailure,
} from "./send-statements";

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
    const sendStatement = buildSendInsert(db, {
      userId: session.user.id,
      climbId,
      climbType: climb.type,
      input,
    });
    try {
      if (input.dateSent) {
        await db.batch([
          sendStatement,
          buildSentJournalInsert(
            db,
            journalEntryFromSend(session.user.id, climbId, input.dateSent, input.comment),
          ),
        ]);
        revalidateJournalSurfaces({ userId: session.user.id, climbIds: [climbId] });
      } else {
        await sendStatement;
      }
    } catch (error) {
      if (isSendClimbGuardFailure(error)) {
        throw new ActionError("Climb changed while this send was being saved — try again.");
      }
      rethrowJournalSendInvariant(
        error,
        "The journal changed while this send was being saved — try again",
      );
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
    const sentEntries = await getSentJournalEntries(db, session.user.id, [existing.climbId]);
    const ascent = sentEntries[0];
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
      if (ascent) assertAscentDateChange(sentEntries, input.dateSent);
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

    await db.batch([
      db.delete(sends).where(eq(sends.id, sendId)),
      db
        .update(journalEntries)
        .set({ sent: false })
        .where(
          and(
            eq(journalEntries.userId, session.user.id),
            eq(journalEntries.climbId, existing.climbId),
            eq(journalEntries.sent, true),
          ),
        ),
    ]);

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
