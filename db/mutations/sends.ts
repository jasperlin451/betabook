"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import { pickFormFields } from "@/lib/validation";

const SEND_FORM_FIELDS = ["ascentStyle", "dateSent", "comment", "rating", "suggestedGrade"] as const;

function readSendFormData(formData: FormData): RawSendInput {
  return pickFormFields(formData, SEND_FORM_FIELDS);
}

export async function createSend(climbId: number, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();

  const climb = await getClimb(db, climbId);
  if (!climb) throw new Error("Climb not found");

  const existing = await getUserSendForClimb(db, session.user.id, climbId);
  if (existing) {
    throw new Error("You've already sent this climb — edit your existing send instead.");
  }

  const input = validateSendInput(climb.type, readSendFormData(formData));
  // db.batch, not a transaction — D1 doesn't give real transaction semantics
  // via drizzle-orm/d1's db.transaction(); batch is D1's actual atomic
  // primitive. Keeps climbs.sendCount/ratingSum/ratingCount (denormalized
  // for getSubtreeClimbs's sort — see drizzle/schema/climbs.ts) in sync with
  // every sends write.
  await db.batch([
    db.insert(sends).values({ userId: session.user.id, climbId, ...input }),
    db
      .update(climbs)
      .set({
        sendCount: sql`${climbs.sendCount} + 1`,
        ratingSum: sql`${climbs.ratingSum} + ${input.rating ?? 0}`,
        ratingCount: sql`${climbs.ratingCount} + ${input.rating != null ? 1 : 0}`,
      })
      .where(eq(climbs.id, climbId)),
  ]);

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  revalidatePath(`/areas/${climb.areaId}`);
}

export async function updateSend(sendId: number, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  const climb = await getClimb(db, existing.climbId);
  if (!climb) throw new Error("Climb not found");

  const input = validateSendInput(climb.type, readSendFormData(formData));

  // sendCount is unchanged by an edit — only the rating can move. Delta
  // covers all four null/non-null transitions (see createSend for why this
  // is a batch, not a transaction).
  const ratingSumDelta = (input.rating ?? 0) - (existing.rating ?? 0);
  const ratingCountDelta = (input.rating != null ? 1 : 0) - (existing.rating != null ? 1 : 0);

  await db.batch([
    db.update(sends).set(input).where(eq(sends.id, sendId)),
    db
      .update(climbs)
      .set({
        ratingSum: sql`${climbs.ratingSum} + ${ratingSumDelta}`,
        ratingCount: sql`${climbs.ratingCount} + ${ratingCountDelta}`,
      })
      .where(eq(climbs.id, climb.id)),
  ]);

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  revalidatePath(`/areas/${climb.areaId}`);
}

export async function deleteSend(sendId: number) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  // See createSend for why this is a batch, not a transaction.
  await db.batch([
    db.delete(sends).where(eq(sends.id, sendId)),
    db
      .update(climbs)
      .set({
        sendCount: sql`${climbs.sendCount} - 1`,
        ratingSum: sql`${climbs.ratingSum} - ${existing.rating ?? 0}`,
        ratingCount: sql`${climbs.ratingCount} - ${existing.rating != null ? 1 : 0}`,
      })
      .where(eq(climbs.id, existing.climbId)),
  ]);

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  const climb = await getClimb(db, existing.climbId);
  if (climb) revalidatePath(`/areas/${climb.areaId}`);
}
