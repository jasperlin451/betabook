"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { initAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import { getClimb, getUserSendForClimb } from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";

async function requireSession() {
  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not signed in");
  return session;
}

function readSendFormData(formData: FormData): RawSendInput {
  return {
    completionType: formData.get("completionType"),
    dateSent: formData.get("dateSent"),
    comment: formData.get("comment"),
    rating: formData.get("rating"),
    suggestedGrade: formData.get("suggestedGrade"),
  };
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
  await db.insert(sends).values({ userId: session.user.id, climbId, ...input });

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/users/${session.user.id}`);
}

export async function updateSend(sendId: number, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  const climb = await getClimb(db, existing.climbId);
  if (!climb) throw new Error("Climb not found");

  const input = validateSendInput(climb.type, readSendFormData(formData));
  await db.update(sends).set(input).where(eq(sends.id, sendId));

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
}

export async function deleteSend(sendId: number) {
  const session = await requireSession();
  const db = await getDb();

  const existing = await db.select().from(sends).where(eq(sends.id, sendId)).get();
  if (!existing || existing.userId !== session.user.id) throw new Error("Send not found");

  await db.delete(sends).where(eq(sends.id, sendId));

  revalidatePath(`/climbs/${existing.climbId}`);
  revalidatePath(`/users/${session.user.id}`);
}
