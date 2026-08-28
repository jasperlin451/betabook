"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { findClimbsByNameAndArea, getUserSentClimbIds } from "@/db/queries";
import { parseGrade } from "@/lib/grades";
import { toActionResult, type ActionResult } from "@/lib/action-result";
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

/** How many rows each insert statement carries — see the comment on the
 * db.batch below. */
const INSERT_CHUNK_SIZE = 10;

/** Imports one wizard batch of rows as the signed-in user's sends.
 *
 * Commit contract: each call is all-or-nothing. Every insert (and its
 * climbs-aggregate update) rides in ONE db.batch, which D1 executes as a
 * single transaction — so `{ ok: true }` means every counted row committed,
 * and `{ ok: false }` means none did. The wizard relies on this to report
 * truthful imported/failed counts and to make retries safe: re-running a
 * failed batch can't duplicate rows (nothing committed), and re-running a
 * successful one is caught by the user+climb duplicate check below (with the
 * sends_user_climb_unique index as the hard backstop). */
export async function importSends(
  rows: NormalizedImportRow[],
  gradeScalePreference: "native" | "converted",
): Promise<ActionResult<ImportResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const alreadySent = await getUserSentClimbIds(db, session.user.id);
    const toInsert: (typeof sends.$inferInsert)[] = [];
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

      if (alreadySent.has(resolved.id)) {
        alreadyLogged++;
        continue;
      }
      alreadySent.add(resolved.id); // guards against duplicate rows within the same CSV too
      affectedAreaIds.add(resolved.areaId);

      toInsert.push({
        userId: session.user.id,
        climbId: resolved.id,
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
          ? parseGrade(resolved.type, row.gradeText, gradeScalePreference)
          : row.blankGradeMeans === "no-suggestion"
            ? null
            : resolved.grade,
        gradeFeel: row.gradeFeel,
      });
    }

    if (toInsert.length > 0) {
      // ONE db.batch for the whole call — a D1 batch runs as a single
      // transaction (and a single Workers subrequest), so every row here
      // commits or none do; a mid-batch failure can't leave earlier chunks
      // committed while the action reports total failure. The insert is
      // still chunked into multiple statements because D1 caps a statement
      // at 100 bound parameters: each sends row binds 8 values (userId,
      // climbId, ascentStyle, dateSent, comment, rating, suggestedGrade,
      // gradeFeel — id is auto-increment, createdAt/updatedAt use SQL
      // defaults), so 10 rows × 8 = 80 stays safely under 100.
      //
      // toInsert's rows are all distinct climbs (alreadySent.add above
      // dedupes climbId across the whole CSV), so one climbs update per row
      // is one update per distinct climb — no aggregation needed.
      const chunks: (typeof sends.$inferInsert)[][] = [];
      for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
        chunks.push(toInsert.slice(i, i + INSERT_CHUNK_SIZE));
      }
      const [firstChunk, ...restChunks] = chunks;
      await db.batch([
        db.insert(sends).values(firstChunk),
        ...restChunks.map((chunk) => db.insert(sends).values(chunk)),
        ...toInsert.map((row) =>
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

      // Same revalidation set as createSend (db/mutations/sends.ts): the
      // batch above mutates climbs.sendCount/ratingSum/ratingCount, which
      // the home page, each climb's page, and each area's climb list all
      // render — not just the user's profile.
      revalidatePath("/");
      revalidatePath(`/users/${session.user.id}`);
      for (const row of toInsert) revalidatePath(`/climbs/${row.climbId}`);
      for (const areaId of affectedAreaIds) revalidatePath(`/areas/${areaId}`);
      refresh();
    }

    return {
      imported: toInsert.length,
      alreadyLogged,
      notFound,
    };
  });
}
