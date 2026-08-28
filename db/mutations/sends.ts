"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import { pickFormFields } from "@/lib/validation";

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
  // climbs.sendCount/ratingSum/ratingCount (denormalized for
  // getSubtreeClimbs's sort — see drizzle/schema/climbs.ts) are maintained
  // by triggers on sends, so this is a plain single-statement write.
  await db.insert(sends).values({ userId: session.user.id, climbId, ...input });

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  revalidatePath(`/areas/${climb.areaId}`);
  refresh();
}

export async function updateSend(sendId: number, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  const climb = await getClimb(db, existing.climbId);
  if (!climb) throw new Error("Climb not found");

  const input = validateSendInput(climb.type, readSendFormData(formData));

  // The climbs aggregates follow this write via trigger — including a
  // rating moving to or from null, which the trigger handles as a full
  // remove-then-add.
  await db.update(sends).set(input).where(eq(sends.id, sendId));

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  revalidatePath(`/areas/${climb.areaId}`);
  refresh();
}

export async function deleteSend(sendId: number) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  await db.delete(sends).where(eq(sends.id, sendId));

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/");
  const climb = await getClimb(db, existing.climbId);
  if (climb) revalidatePath(`/areas/${climb.areaId}`);
  refresh();
}
