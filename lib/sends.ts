import { ActionError } from "@/lib/action-result";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { parseGradeIndex, trimOrNull } from "@/lib/validation";

export const ASCENT_STYLES = ["redpoint", "flash", "onsight"] as const;
export type AscentStyle = (typeof ASCENT_STYLES)[number];
export const MAX_COMMENT_LENGTH = 1000;

export const IMPORT_BATCH_SIZE = 50;

// How many distinct climb names one resolveImportClimbs call may look up.
// They travel as a single JSON binding (see findClimbCandidatesByNames), so
// this bounds the statement's work and the response size rather than D1's
// bound-parameter cap.
export const RESOLVE_BATCH_SIZE = 100;

export const GRADE_FEEL_VALUES = ["low", "solid", "high"] as const;
export type GradeFeel = (typeof GRADE_FEEL_VALUES)[number];

// Consensus math: a "low" send nudges the community average a third of a
// grade-step easier, "high" a third harder, so the aggregate can land
// between whole grades (1, 2, 3 -> .7, 1, 1.3, 1.7, 2, 2.3...) instead of
// only ever landing on one.
export const GRADE_FEEL_OFFSET: Record<GradeFeel, number> = {
  low: -0.3,
  solid: 0,
  high: 0.3,
};

export type SendInput = {
  ascentStyle: AscentStyle;
  dateSent: string | null;
  comment: string | null;
  rating: number | null;
  suggestedGrade: number;
  gradeFeel: GradeFeel;
};

export type RawSendInput = {
  ascentStyle: FormDataEntryValue | null;
  dateSent: FormDataEntryValue | null;
  comment: FormDataEntryValue | null;
  rating: FormDataEntryValue | null;
  suggestedGrade: FormDataEntryValue | null;
  gradeFeel: FormDataEntryValue | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Clients submit the user's local calendar date, but the server runs at UTC
 * (Cloudflare) and can't know the client's timezone — a user's local today
 * can be up to a day ahead of UTC today (UTC+14). Tolerate one day past UTC
 * today so a valid local-today send isn't rejected; anything beyond that is
 * clearly future.
 */
export function latestAcceptableSendDate(todayUtc: string): string {
  const [year, month, day] = todayUtc.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// Shared by both paths that write a send: the form (validateSendInput) and
// the CSV import (validateImportSendValues). A server action's arguments are
// an HTTP boundary with no types left at runtime, so each path enforces these
// itself rather than trusting its caller.

function parseAscentStyle(value: unknown): AscentStyle {
  if (typeof value !== "string" || !(ASCENT_STYLES as readonly string[]).includes(value)) {
    throw new ActionError("Invalid ascent style");
  }
  return value as AscentStyle;
}

/** ISO shape AND a date that exists. The shape check alone passes 2026-02-30
 * and 2026-13-01, which the wizard's date-fns parse rejects — round-tripping
 * through UTC is what catches a day the month doesn't have. */
export function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function parseDateSent(value: unknown, today: string): string | null {
  if (value === null || value === undefined) return null;
  // Absent is null or blank. Anything else non-string is a caller sending
  // something a date field can't hold, which is an error rather than "none".
  if (typeof value !== "string") {
    throw new ActionError("Invalid send date");
  }
  const dateSent = value.trim();
  if (!dateSent) return null;
  if (!isRealIsoDate(dateSent)) {
    throw new ActionError("Invalid send date");
  }
  if (dateSent > latestAcceptableSendDate(today)) {
    throw new ActionError("Send date can't be in the future");
  }
  return dateSent;
}

/** Whole 1–5, or absent. Strict because the sends_aggregates triggers fold
 * every rating into climbs.rating_sum, which climbs.avg_rating is generated
 * from — one out-of-range value moves a shared climb's public average. */
function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function parseGradeFeel(value: unknown): GradeFeel {
  return typeof value === "string" && (GRADE_FEEL_VALUES as readonly string[]).includes(value)
    ? (value as GradeFeel)
    : "solid";
}

/**
 * `today` defaults to the real clock but is overridable so tests can check
 * the future-date rejection without depending on the system clock.
 */
export function validateSendInput(
  climbType: ClimbType,
  raw: RawSendInput,
  today: string = new Date().toISOString().slice(0, 10),
): SendInput {
  const ascentStyle = parseAscentStyle(raw.ascentStyle);
  const dateSent = parseDateSent(raw.dateSent, today);

  const comment = trimOrNull(raw.comment);
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    throw new ActionError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  // A form field arrives as a string, so coerce before the shared rule.
  // Empty means "no rating selected", not zero.
  const rating = raw.rating ? Number(raw.rating) : null;
  if (rating !== null && !isRating(rating)) {
    throw new ActionError("Rating must be between 1 and 5");
  }

  const suggestedGrade = parseGradeIndex(
    raw.suggestedGrade,
    nativeGradeArray(climbType).length,
    "Suggested grade",
  );

  return {
    ascentStyle,
    dateSent,
    comment,
    rating,
    suggestedGrade,
    gradeFeel: parseGradeFeel(raw.gradeFeel),
  };
}

/** The client-supplied half of an import row. No `suggestedGrade`: the import
 * derives that server-side, so it never needs checking. */
export type ImportSendValues = {
  ascentStyle: AscentStyle;
  dateSent: string | null;
  comment: string | null;
  rating: number | null;
  gradeFeel: GradeFeel;
};

/** One row as the wizard hands it to importSends: a climb already resolved
 * to an id (in the wizard's match step), plus the send's values. The grade
 * stays as text because the ordinal depends on the resolved climb's type,
 * which only the server trusts itself to know. */
export type ImportSendRow = ImportSendValues & {
  climbId: number;
  gradeText: string | null;
  /** What a null gradeText means — see NormalizedImportRow.blankGradeMeans. */
  blankGradeMeans: "posted-grade" | "no-suggestion";
};

/** Server-side enforcement of the contract normalizeRows applies in the
 * browser, for callers that skipped the wizard. It coerces where normalizeRows
 * coerces (rating out of range to null, comment truncated, unknown grade feel
 * to "solid") and rejects where it rejects (ascent style, date), so a row that
 * did come through the wizard passes through unchanged. */
export function validateImportSendValues(
  row: {
    ascentStyle: unknown;
    dateSent: unknown;
    comment: unknown;
    rating: unknown;
    gradeFeel: unknown;
  },
  today: string = new Date().toISOString().slice(0, 10),
): ImportSendValues {
  const comment = typeof row.comment === "string" ? row.comment.trim() : "";
  return {
    ascentStyle: parseAscentStyle(row.ascentStyle),
    dateSent: parseDateSent(row.dateSent, today),
    comment: comment ? comment.slice(0, MAX_COMMENT_LENGTH) : null,
    rating: isRating(row.rating) ? row.rating : null,
    gradeFeel: parseGradeFeel(row.gradeFeel),
  };
}
