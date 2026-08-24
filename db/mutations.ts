"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { initAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { areas, climbs, sends } from "@/db/schema";
import {
  findClimbsByNameAndArea,
  getArea,
  getClimb,
  getUserSendForClimb,
  getUserSentClimbIds,
} from "@/db/queries";
import { validateSendInput, type RawSendInput } from "@/lib/sends";
import {
  validateClimbInput,
  validateNewClimbInput,
  type RawClimbInput,
} from "@/lib/climbs";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
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
    ascentStyle: formData.get("ascentStyle"),
    dateSent: formData.get("dateSent"),
    comment: formData.get("comment"),
    rating: formData.get("rating"),
    suggestedGrade: formData.get("suggestedGrade"),
  };
}

function readClimbFormData(formData: FormData): RawClimbInput {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    grade: formData.get("grade"),
    description: formData.get("description"),
  };
}

function readAreaFormData(formData: FormData): RawAreaInput {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
  };
}

export async function updateClimb(climbId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = await getClimb(db, climbId);
  if (!existing) throw new Error("Climb not found");

  const input = validateClimbInput(existing, readClimbFormData(formData));
  await db.update(climbs).set(input).where(eq(climbs.id, climbId));

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
}

export async function createClimb(areaId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const area = await getArea(db, areaId);
  if (!area) throw new Error("Area not found");

  const input = validateNewClimbInput(readClimbFormData(formData));
  await db.insert(climbs).values({ areaId, lft: area.lft, rght: area.rght, ...input });

  revalidatePath(`/areas/${areaId}`);
  revalidatePath("/");
}

export async function updateArea(areaId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = await getArea(db, areaId);
  if (!existing) throw new Error("Area not found");

  const input = validateAreaInput(readAreaFormData(formData));
  await db.update(areas).set(input).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
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

export type ImportRowFailureReason = "climb-not-found" | "climb-ambiguous";
export type ImportResult = {
  imported: number;
  alreadyLogged: number;
  notFound: Array<{
    climbName: string;
    areaName: string;
    dateSent: string | null;
    reason: ImportRowFailureReason;
    raw: Record<string, string>;
  }>;
};

// D1 caps queries at 100 bound parameters. Each sends row binds 7 values
// (userId, climbId, ascentStyle, dateSent, comment, rating,
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
        raw: row.raw,
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
      ascentStyle: row.ascentStyle,
      dateSent: row.dateSent,
      comment: row.comment,
      rating: row.rating,
      suggestedGrade: row.gradeText
        ? parseGrade(resolved.type, row.gradeText, gradeScalePreference)
        : resolved.grade,
    });
  }

  // Each chunk's rows are all distinct climbs (alreadySent.add above
  // dedupes climbId across the whole CSV), so one climbs update per row is
  // one update per distinct climb — no in-chunk aggregation needed. Batched
  // with the insert per createSend's reasoning (D1 batch, not a
  // transaction).
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
    await db.batch([
      db.insert(sends).values(chunk),
      ...chunk.map((row) =>
        db
          .update(climbs)
          .set({
            sendCount: sql`${climbs.sendCount} + 1`,
            ratingSum: sql`${climbs.ratingSum} + ${row.rating ?? 0}`,
            ratingCount: sql`${climbs.ratingCount} + ${row.rating != null ? 1 : 0}`,
          })
          .where(eq(climbs.id, row.climbId)),
      ),
    ]);
  }

  revalidatePath(`/users/${session.user.id}`);
  return { imported: toInsert.length, alreadyLogged, notFound };
}
