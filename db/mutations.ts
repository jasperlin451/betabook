"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { initAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import {
  findClimbsByNameAndArea,
  getClimb,
  getUserSendForClimb,
  getUserSentClimbIds,
} from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import { parseGrade } from "@/lib/grades";
import type { NormalizedImportRow } from "@/lib/sends-import";

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

export type ImportRowFailureReason = "climb-not-found" | "climb-ambiguous";
export type ImportResult = {
  imported: number;
  alreadyLogged: number;
  notFound: Array<{
    climbName: string;
    areaName: string;
    dateSent: string | null;
    reason: ImportRowFailureReason;
  }>;
};

// D1 caps queries at 100 bound parameters. Each sends row binds 7 values
// (userId, climbId, completionType, dateSent, comment, rating,
// suggestedGrade — id is auto-increment, createdAt/updatedAt use SQL
// defaults, so those aren't bound). 10 rows × 7 = 70, safely under 100.
const INSERT_CHUNK_SIZE = 10;

export async function importSends(
  rows: NormalizedImportRow[],
  gradeScalePreference: "native" | "converted",
): Promise<ImportResult> {
  const session = await requireSession();
  const db = await getDb();

  const alreadySent = await getUserSentClimbIds(db, session.user.id);
  const toInsert: (typeof sends.$inferInsert)[] = [];
  const notFound: ImportResult["notFound"] = [];
  let alreadyLogged = 0;

  for (const row of rows) {
    const matches = await findClimbsByNameAndArea(db, row.climbName, row.areaName);

    // Exactly one match: done. Multiple matches: only resolves if the CSV's
    // (optional) climb-type hint narrows it to exactly one; otherwise still
    // ambiguous. Zero matches: not found.
    const narrowed = row.climbTypeHint
      ? matches.filter((m) => m.type === row.climbTypeHint)
      : matches;
    const resolved = narrowed.length === 1 ? narrowed[0] : undefined;

    if (!resolved) {
      notFound.push({
        climbName: row.climbName,
        areaName: row.areaName,
        dateSent: row.dateSent,
        reason: matches.length === 0 ? "climb-not-found" : "climb-ambiguous",
      });
      continue;
    }

    if (alreadySent.has(resolved.id)) {
      alreadyLogged++;
      continue;
    }
    alreadySent.add(resolved.id); // guards against duplicate rows within the same CSV too

    toInsert.push({
      userId: session.user.id,
      climbId: resolved.id,
      completionType: row.completionType,
      dateSent: row.dateSent,
      comment: row.comment,
      rating: row.rating,
      suggestedGrade: row.gradeText
        ? parseGrade(resolved.type, row.gradeText, gradeScalePreference)
        : null,
    });
  }

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    await db.insert(sends).values(toInsert.slice(i, i + INSERT_CHUNK_SIZE));
  }

  revalidatePath(`/users/${session.user.id}`);
  return { imported: toInsert.length, alreadyLogged, notFound };
}
