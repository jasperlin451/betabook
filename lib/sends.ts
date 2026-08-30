import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { ActionError } from "@/lib/action-result";
import { parseGradeIndex, trimOrNull } from "@/lib/validation";

export const ASCENT_STYLES = ["redpoint", "flash", "onsight"] as const;
export type AscentStyle = (typeof ASCENT_STYLES)[number];
export const MAX_COMMENT_LENGTH = 1000;

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

function isAscentStyle(value: FormDataEntryValue | null): value is AscentStyle {
  return (
    typeof value === "string" &&
    (ASCENT_STYLES as readonly string[]).includes(value)
  );
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
  if (!isAscentStyle(raw.ascentStyle)) {
    throw new ActionError("Invalid ascent style");
  }

  const dateSent = typeof raw.dateSent === "string" ? raw.dateSent.trim() : "";
  if (dateSent && !ISO_DATE_RE.test(dateSent)) {
    throw new ActionError("Invalid send date");
  }
  if (dateSent && dateSent > latestAcceptableSendDate(today)) {
    throw new ActionError("Send date can't be in the future");
  }

  const comment = trimOrNull(raw.comment);
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    throw new ActionError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  const rating = raw.rating ? Number(raw.rating) : null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new ActionError("Rating must be between 1 and 5");
  }

  const suggestedGrade = parseGradeIndex(
    raw.suggestedGrade,
    nativeGradeArray(climbType).length,
    "Suggested grade",
  );

  const gradeFeel: GradeFeel =
    typeof raw.gradeFeel === "string" &&
    (GRADE_FEEL_VALUES as readonly string[]).includes(raw.gradeFeel)
      ? (raw.gradeFeel as GradeFeel)
      : "solid";

  return {
    ascentStyle: raw.ascentStyle,
    dateSent: dateSent || null,
    comment,
    rating,
    suggestedGrade,
    gradeFeel,
  };
}
