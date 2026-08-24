"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { findClimbsByNameAndArea, getUserSentClimbIds } from "@/db/queries";
import { parseGrade } from "@/lib/grades";
import type { NormalizedImportRow } from "@/lib/sends-import";

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
