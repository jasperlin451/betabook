"use server";

import { refresh, revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { sends } from "@/db/schema";
import { findClimbsByNameAndArea, getUserSentClimbIds } from "@/db/queries";
import { parseGrade } from "@/lib/grades";
import { toActionResult, type ActionResult } from "@/lib/action-result";
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

// How many rows each insert statement carries. D1 caps a statement at 100
// bound parameters, and each inserted sends row binds 8 values (userId,
// climbId, ascentStyle, dateSent, comment, rating, suggestedGrade, gradeFeel
// — id is auto-increment, createdAt/updatedAt use SQL defaults, so those
// aren't bound). 10 rows × 8 = 80, safely under 100. Overwrites need no such
// chunking: an update is one statement per row either way.
const INSERT_CHUNK_SIZE = 10;

/** Imports one wizard batch of rows as the signed-in user's sends.
 *
 * Commit contract: each call is all-or-nothing. Every insert and overwrite
 * rides in ONE db.batch, which D1 executes as a single transaction (the
 * climbs-aggregate triggers fire inside it too) — so `{ ok: true }` means
 * every counted row committed and `{ ok: false }` means none did.
 *
 * The wizard relies on this to report
 * truthful imported/failed counts and to make retries safe: re-running a
 * failed batch can't duplicate rows (nothing committed), and re-running a
 * successful one is caught by the user+climb duplicate check below (with the
 * sends_user_climb_unique index as the hard backstop). */
export async function importSends(
  rows: NormalizedImportRow[],
  options: ImportOptions,
): Promise<ActionResult<ImportResult>> {
  return toActionResult(async () => {
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
    const affectedAreaIds = new Set<number>();
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
        // With grade text, parse it (null if unrecognized). Without it, the
        // fallback depends on which column the text came from: a mapped
        // Suggested Grade column with a blank cell means the send genuinely
        // has no suggestion (betabook exports round-trip losslessly), while
        // a Grade-column-only mapping keeps the old fallback to the climb's
        // posted grade. See NormalizedImportRow.blankGradeMeans.
        suggestedGrade: row.gradeText
          ? parseGrade(resolved.type, row.gradeText, options.gradeScale)
          : row.blankGradeMeans === "no-suggestion"
            ? null
            : resolved.grade,
        gradeFeel: row.gradeFeel,
      };

      processed.add(resolved.id);
      affectedAreaIds.add(resolved.areaId);

      if (alreadySent.has(resolved.id)) {
        toUpdate.push({ climbId: resolved.id, values });
      } else {
        toInsert.push({ userId: session.user.id, climbId: resolved.id, ...values });
      }
    }

    // ONE db.batch for the whole call — a D1 batch runs as a single
    // transaction (and a single Workers subrequest), so every row here commits
    // or none do; a mid-batch failure can't leave earlier chunks committed
    // while the action reports the whole call failed. The inserts are still
    // split across statements because of the D1 bound-parameter cap (see
    // INSERT_CHUNK_SIZE); the updates are one statement per row regardless.
    //
    // climbs.sendCount/ratingSum/ratingCount follow both via the triggers on
    // sends (see drizzle/schema/climbs.ts), so neither carries a companion
    // aggregate write — the triggers fire inside this same transaction.
    const statements = [
      ...Array.from({ length: Math.ceil(toInsert.length / INSERT_CHUNK_SIZE) }, (_, i) =>
        db.insert(sends).values(toInsert.slice(i * INSERT_CHUNK_SIZE, (i + 1) * INSERT_CHUNK_SIZE)),
      ),
      // (userId, climbId) is uniquely indexed, so each of these targets exactly
      // one row without needing the existing send's id. sends.updatedAt has
      // $onUpdate, so drizzle stamps it.
      ...toUpdate.map(({ climbId, values }) =>
        db
          .update(sends)
          .set(values)
          .where(and(eq(sends.userId, session.user.id), eq(sends.climbId, climbId))),
      ),
    ];

    if (statements.length > 0) {
      // db.batch wants a non-empty tuple; the guard above already ensures it.
      await db.batch(statements as [(typeof statements)[number], ...typeof statements]);

      // Same revalidation set as createSend (db/mutations/sends.ts): the batch
      // above moves climbs.sendCount/ratingSum/ratingCount, which the home
      // page, each climb's page, and each area's climb list all render — not
      // just the user's profile.
      revalidatePath("/");
      revalidatePath(`/users/${session.user.id}`);
      for (const row of toInsert) revalidatePath(`/climbs/${row.climbId}`);
      for (const { climbId } of toUpdate) revalidatePath(`/climbs/${climbId}`);
      for (const areaId of affectedAreaIds) revalidatePath(`/areas/${areaId}`);
      refresh();
    }

    return {
      imported: toInsert.length,
      overwritten: toUpdate.length,
      alreadyLogged,
      notFound,
    };
  });
}
