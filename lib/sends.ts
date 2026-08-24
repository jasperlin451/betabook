import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { parseGradeIndex, trimOrNull } from "@/lib/validation";

export const ASCENT_STYLES = ["redpoint", "flash", "onsight"] as const;
export type AscentStyle = (typeof ASCENT_STYLES)[number];
export const MAX_COMMENT_LENGTH = 280;

export type SendInput = {
  ascentStyle: AscentStyle;
  dateSent: string | null;
  comment: string | null;
  rating: number | null;
  suggestedGrade: number;
};

export type RawSendInput = {
  ascentStyle: FormDataEntryValue | null;
  dateSent: FormDataEntryValue | null;
  comment: FormDataEntryValue | null;
  rating: FormDataEntryValue | null;
  suggestedGrade: FormDataEntryValue | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    throw new Error("Invalid ascent style");
  }

  const dateSent = typeof raw.dateSent === "string" ? raw.dateSent.trim() : "";
  if (dateSent && !ISO_DATE_RE.test(dateSent)) {
    throw new Error("Invalid send date");
  }
  if (dateSent && dateSent > today) {
    throw new Error("Send date can't be in the future");
  }

  const comment = trimOrNull(raw.comment);
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  const rating = raw.rating ? Number(raw.rating) : null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5");
  }

  const suggestedGrade = parseGradeIndex(
    raw.suggestedGrade,
    nativeGradeArray(climbType).length,
    "Suggested grade",
  );

  return {
    ascentStyle: raw.ascentStyle,
    dateSent: dateSent || null,
    comment,
    rating,
    suggestedGrade,
  };
}
