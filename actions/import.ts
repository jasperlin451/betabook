"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db/client";
import {
  findClimbCandidatesByNames,
  findClimbCandidatesInAreas,
  getClimbsByIds,
  getUserSentClimbIds,
  type ClimbCandidate,
} from "@/db/queries";
import { sends } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { parseGrade } from "@/lib/grades";
import {
  IMPORT_BATCH_SIZE,
  RESOLVE_BATCH_SIZE,
  validateImportSendValues,
  type ImportSendRow,
} from "@/lib/sends";
import { requireSession } from "@/lib/session";

import { revalidateSendSurfaces } from "./revalidation";

export type ImportResult = {
  imported: number;
  overwritten: number;
  alreadyLogged: number;
  /** Positions (within this call's `rows`) whose climb no longer exists —
   * deleted between the wizard's match step and this commit. */
  missing: number[];
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

/** Every climb sharing one of `names`, for the import wizard's match step.
 * Read-only, but signed-in only: up to 25 climbs per name for 100 names a
 * call is a bulk shape no anonymous surface needs. The wizard groups the
 * flat list by `key` (lib/import-matching's indexCandidates). */
export async function resolveImportClimbs(
  names: string[],
): Promise<ActionResult<ClimbCandidate[]>> {
  return toActionResult(async () => {
    await requireSession();

    if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
      throw new ActionError("Invalid climb names");
    }
    if (names.length > RESOLVE_BATCH_SIZE) {
      throw new ActionError(`A lookup can carry at most ${RESOLVE_BATCH_SIZE} climb names`);
    }

    const db = await getDb();
    return findClimbCandidatesByNames(db, names);
  });
}

/** Every climb named one of `pairs`' names inside its paired area, for the
 * rows whose name was cut to the per-name cap above (see areaLookupsNeeded).
 * Same access rule as resolveImportClimbs. */
export async function resolveImportClimbsInAreas(
  pairs: { name: string; areaName: string }[],
): Promise<ActionResult<ClimbCandidate[]>> {
  return toActionResult(async () => {
    await requireSession();

    if (
      !Array.isArray(pairs) ||
      pairs.some((pair) => typeof pair?.name !== "string" || typeof pair?.areaName !== "string")
    ) {
      throw new ActionError("Invalid climb names");
    }
    if (pairs.length > RESOLVE_BATCH_SIZE) {
      throw new ActionError(
        `A lookup can carry at most ${RESOLVE_BATCH_SIZE} climb and area pairs`,
      );
    }

    const db = await getDb();
    return findClimbCandidatesInAreas(db, pairs);
  });
}

/** `rows` arrives over HTTP, so its type is a claim rather than a guarantee;
 * the send values are re-validated by validateImportSendValues below, and
 * this checks the part that isn't a send value. */
function parseClimbId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ActionError("Invalid import rows");
  }
  return value;
}

/** Imports one wizard batch of rows as the signed-in user's sends. Each row
 * names its climb by id — resolved beforehand in the wizard's match step via
 * resolveImportClimbs — so this call's work doesn't scale with row count
 * beyond the writes themselves (see IMPORT_BATCH_SIZE).
 *
 * Commit contract: each call is all-or-nothing. Every insert and overwrite
 * rides in ONE db.batch, which D1 executes as a single transaction (the
 * climbs-aggregate triggers fire inside it too) — so `{ ok: true }` means
 * every counted row committed and `{ ok: false }` means none did.
 *
 * The wizard relies on this to report truthful imported/failed counts and
 * to make retries safe: re-running a failed batch can't duplicate rows
 * (nothing committed), and re-running a successful one is caught by the
 * user+climb duplicate check below (with the sends_user_climb_unique index
 * as the hard backstop). */
export async function importSends(
  rows: ImportSendRow[],
  options: ImportOptions,
): Promise<ActionResult<ImportResult>> {
  return toActionResult(async () => {
    const session = await requireSession();

    if (!Array.isArray(rows)) throw new ActionError("Invalid import rows");
    if (rows.length > IMPORT_BATCH_SIZE) {
      throw new ActionError(`An import batch can carry at most ${IMPORT_BATCH_SIZE} rows`);
    }
    const climbIds = rows.map((row) => parseClimbId(row?.climbId));

    const db = await getDb();
    const [climbList, alreadySent] = await Promise.all([
      getClimbsByIds(db, climbIds),
      getUserSentClimbIds(db, session.user.id, climbIds),
    ]);
    const climbsById = new Map(climbList.map((climb) => [climb.id, climb]));

    // Climbs this call has already acted on. Kept separate from alreadySent
    // (which is "already in the DB") so a second CSV row for the same climb
    // is a no-op either way: in overwrite mode it would otherwise issue two
    // UPDATEs to the same row in one batch. First row for a climb wins.
    const processed = new Set<number>();
    const toInsert: (typeof sends.$inferInsert)[] = [];
    const toUpdate: Array<{ climbId: number; values: SendValues }> = [];
    const affectedAreaIds = new Set<number>();
    const missing: number[] = [];
    let alreadyLogged = 0;

    for (const [index, row] of rows.entries()) {
      const climb = climbsById.get(climbIds[index]);
      if (!climb) {
        missing.push(index);
        continue;
      }

      if (processed.has(climb.id)) {
        alreadyLogged += 1;
        continue;
      }

      if (alreadySent.has(climb.id) && options.onConflict === "skip") {
        alreadyLogged += 1;
        continue;
      }

      // Identical for both branches apart from userId/climbId — which is what
      // makes an overwrite a whole-row replacement: the send ends up as
      // exactly what the CSV row normalizes to, cleared fields included.
      // normalizeImportRows applied these same rules in the browser;
      // validateImportSendValues is what makes them true of every caller.
      const gradeText = typeof row.gradeText === "string" ? row.gradeText : null;
      const values: SendValues = {
        ...validateImportSendValues(row),
        // Server-derived, so it skips that check — parseGrade only ever
        // returns an index into a fixed table. With no grade text, the
        // fallback depends on which column it would have come from: a mapped
        // Suggested Grade column with a blank cell means the send genuinely
        // has no suggestion (betabook exports round-trip losslessly), while a
        // Grade-column-only mapping keeps the old fallback to the climb's
        // posted grade. See NormalizedImportRow.blankGradeMeans.
        suggestedGrade: gradeText
          ? parseGrade(climb.type, gradeText, options.gradeScale)
          : row.blankGradeMeans === "no-suggestion"
            ? null
            : climb.grade,
      };

      processed.add(climb.id);
      affectedAreaIds.add(climb.areaId);

      if (alreadySent.has(climb.id)) {
        toUpdate.push({ climbId: climb.id, values });
      } else {
        toInsert.push({ userId: session.user.id, climbId: climb.id, ...values });
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
      revalidateSendSurfaces({
        userIds: [session.user.id],
        climbIds: [
          ...toInsert.map((row) => row.climbId),
          ...toUpdate.map(({ climbId }) => climbId),
        ],
        areaIds: affectedAreaIds,
      });
      refresh();
    }

    return {
      imported: toInsert.length,
      overwritten: toUpdate.length,
      alreadyLogged,
      missing,
    };
  });
}
