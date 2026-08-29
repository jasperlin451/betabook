"use server";

import { refresh, revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import { findClimbsByNameAndArea, getUserSentClimbIds } from "@/db/queries";
import { parseGrade } from "@/lib/grades";
import type { NormalizedImportRow } from "@/lib/sends-import";

export type ImportRowFailureReason = "climb-not-found" | "climb-ambiguous";
export type ImportResult = {
  imported: number;
  overwritten: number;
  alreadyLogged: number;
  notFound: Array<{
    climbName: string;
    areaName: string;
    dateSent: string | null;
    reason: ImportRowFailureReason;
    raw: Record<string, string>;
  }>;
};

export type ImportOptions = {
  gradeScale: "native" | "converted";
  /** What to do with a row whose climb the user has already logged: keep the
   * existing send, or replace it wholesale with the CSV row. */
  onConflict: "skip" | "overwrite";
};

/** The columns an import row writes — everything on a send except the keys
 * and the timestamps. Shared by the insert and overwrite paths. */
type SendValues = Omit<
  typeof sends.$inferInsert,
  "id" | "userId" | "climbId" | "createdAt" | "updatedAt"
>;

// D1 caps queries at 100 bound parameters. Each inserted sends row binds 8
// values (userId, climbId, ascentStyle, dateSent, comment, rating,
// suggestedGrade, gradeFeel — id is auto-increment, createdAt/updatedAt use
// SQL defaults, so those aren't bound). 10 rows × 8 = 80, safely under 100.
// The overwrite loop reuses the size for a different reason: an update is
// one statement per row rather than one per chunk, so this bounds how many
// statements ride in a single db.batch.
const CHUNK_SIZE = 10;

export async function importSends(
  rows: NormalizedImportRow[],
  options: ImportOptions,
): Promise<ImportResult> {
  const session = await requireSession();
  const db = await getDb();

  const alreadySent = await getUserSentClimbIds(db, session.user.id);
  // Climbs this call has already acted on. Kept separate from alreadySent
  // (which is "already in the DB") so a second CSV row for the same climb
  // is a no-op either way: in overwrite mode it would otherwise issue two
  // UPDATEs to the same row in one batch. First row for a climb wins.
  const processed = new Set<number>();
  const toInsert: (typeof sends.$inferInsert)[] = [];
  const toUpdate: Array<{ climbId: number; values: SendValues }> = [];
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

    if (processed.has(resolved.id)) {
      alreadyLogged++;
      continue;
    }

    if (alreadySent.has(resolved.id) && options.onConflict === "skip") {
      alreadyLogged++;
      continue;
    }

    // Identical for both branches apart from userId/climbId — which is what
    // makes an overwrite a whole-row replacement: the send ends up as
    // exactly what the CSV row normalizes to, cleared fields included.
    const values: SendValues = {
      ascentStyle: row.ascentStyle,
      dateSent: row.dateSent,
      comment: row.comment,
      rating: row.rating,
      suggestedGrade: row.gradeText
        ? parseGrade(resolved.type, row.gradeText, options.gradeScale)
        : resolved.grade,
      gradeFeel: row.gradeFeel,
    };

    processed.add(resolved.id);

    if (alreadySent.has(resolved.id)) {
      toUpdate.push({ climbId: resolved.id, values });
    } else {
      toInsert.push({ userId: session.user.id, climbId: resolved.id, ...values });
    }
  }

  // climbs.sendCount/ratingSum/ratingCount follow both loops below via the
  // triggers on sends (see drizzle/schema/climbs.ts), so neither carries a
  // companion aggregate write.
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    await db.insert(sends).values(toInsert.slice(i, i + CHUNK_SIZE));
  }

  // (userId, climbId) is uniquely indexed, so each of these targets exactly
  // one row without needing the existing send's id. sends.updatedAt has
  // $onUpdate, so drizzle stamps it.
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const statements = toUpdate.slice(i, i + CHUNK_SIZE).map(({ climbId, values }) =>
      db
        .update(sends)
        .set(values)
        .where(and(eq(sends.userId, session.user.id), eq(sends.climbId, climbId))),
    );
    // db.batch wants a non-empty tuple; the loop bounds already guarantee it.
    await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
  }

  revalidatePath(`/users/${session.user.id}`);
  refresh();
  return {
    imported: toInsert.length,
    overwritten: toUpdate.length,
    alreadyLogged,
    notFound,
  };
}
