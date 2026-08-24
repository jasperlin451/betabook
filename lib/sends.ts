import { nativeGradeArray, type ClimbType } from "@/lib/grades";

export const COMPLETION_TYPES = ["redpoint", "flash", "onsight"] as const;
export type CompletionType = (typeof COMPLETION_TYPES)[number];
export const MAX_COMMENT_LENGTH = 280;

export type SendInput = {
  completionType: CompletionType;
  dateSent: string | null;
  comment: string | null;
  rating: number | null;
  suggestedGrade: number;
};

export type RawSendInput = {
  completionType: FormDataEntryValue | null;
  dateSent: FormDataEntryValue | null;
  comment: FormDataEntryValue | null;
  rating: FormDataEntryValue | null;
  suggestedGrade: FormDataEntryValue | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isCompletionType(value: FormDataEntryValue | null): value is CompletionType {
  return (
    typeof value === "string" &&
    (COMPLETION_TYPES as readonly string[]).includes(value)
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
  if (!isCompletionType(raw.completionType)) {
    throw new Error("Invalid completion type");
  }

  const dateSent = typeof raw.dateSent === "string" ? raw.dateSent.trim() : "";
  if (dateSent && !ISO_DATE_RE.test(dateSent)) {
    throw new Error("Invalid send date");
  }
  if (dateSent && dateSent > today) {
    throw new Error("Send date can't be in the future");
  }

  const comment =
    typeof raw.comment === "string" && raw.comment.trim() ? raw.comment.trim() : null;
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  const rating = raw.rating ? Number(raw.rating) : null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5");
  }

  if (raw.suggestedGrade === null || raw.suggestedGrade === "") {
    throw new Error("Suggested grade is required");
  }
  const suggestedGrade = Number(raw.suggestedGrade);
  const bounds = nativeGradeArray(climbType).length;
  if (!Number.isInteger(suggestedGrade) || suggestedGrade < 0 || suggestedGrade >= bounds) {
    throw new Error("Invalid suggested grade");
  }

  return {
    completionType: raw.completionType,
    dateSent: dateSent || null,
    comment,
    rating,
    suggestedGrade,
  };
}
