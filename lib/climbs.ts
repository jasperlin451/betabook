import type { Climb } from "@/db/queries";
import { ActionError } from "@/lib/action-result";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { parseGradeIndex, requireTrimmed, trimOrNull } from "@/lib/validation";

const CLIMB_TYPES = ["boulder", "sport", "trad"] as const;

export type ClimbInput = {
  name: string;
  type: ClimbType;
  grade: number;
  description: string | null;
};

export type RawClimbInput = {
  name: FormDataEntryValue | null;
  type: FormDataEntryValue | null;
  grade: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
};

export type RawClimbDescriptionInput = {
  description: FormDataEntryValue | null;
};

/** Also used to validate a `type` search param (see app/climbs/new), so this
 * takes `unknown` rather than just a form value. */
export function isClimbType(value: unknown): value is ClimbType {
  return typeof value === "string" && (CLIMB_TYPES as readonly string[]).includes(value);
}

export function validateNewClimbInput(raw: RawClimbInput): ClimbInput {
  const name = requireTrimmed(raw.name, "Name");

  if (!isClimbType(raw.type)) {
    throw new ActionError("Invalid discipline");
  }
  const type = raw.type;

  const grade = parseGradeIndex(raw.grade, nativeGradeArray(type).length, "Grade");
  const description = trimOrNull(raw.description);

  return { name, type, grade, description };
}

/** Full edit — name/discipline/grade/description — is moderation-exclusive
 * (see actions/moderation.ts's requestClimbEdit); the direct action only
 * ever validates the description. */
export function validateClimbDescriptionInput(raw: RawClimbDescriptionInput): {
  description: string | null;
} {
  return { description: trimOrNull(raw.description) };
}

/** Validates a requested full edit against the climb it targets. Discipline
 * still can't change once sends exist: that's a data-integrity rule
 * independent of who's allowed to request the edit. */
export function validateClimbEditInput(existing: Climb, raw: RawClimbInput): ClimbInput {
  const input = validateNewClimbInput(raw);
  if (input.type !== existing.type && existing.sendCount > 0) {
    throw new ActionError("Can't change discipline once a climb has logged sends");
  }
  return input;
}

/** The target-climb fields a merge may rewrite — a strict subset of
 * ClimbInput: `type` must already match (see assertClimbMergeable) and the
 * target's area always wins a merge. */
export type ClimbMergeOverrides = Partial<Pick<ClimbInput, "name" | "grade" | "description">>;

/** Grades arrive as numbers from our own UI but the payload is untrusted
 * JSON, so both number and string forms are parseable; anything else falls
 * through to the validator's own "required" error. */
function asGradeValue(value: unknown): FormDataEntryValue | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/** Treats `raw` as fully untrusted — it arrives either as a Server Action
 * argument (client-controlled at runtime regardless of its TypeScript type)
 * or out of a stored JSON payload. Only the three whitelisted keys are ever
 * read, each re-validated against the target climb, so a crafted object
 * can't smuggle other columns into the merge's UPDATE. */
export function validateClimbMergeOverrides(target: Climb, raw: unknown): ClimbMergeOverrides {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ActionError("Invalid merge overrides");
  }
  const fields = raw as Record<string, unknown>;
  const overrides: ClimbMergeOverrides = {};
  if (fields.name !== undefined) {
    overrides.name = requireTrimmed(typeof fields.name === "string" ? fields.name : null, "Name");
  }
  if (fields.grade !== undefined) {
    overrides.grade = parseGradeIndex(
      asGradeValue(fields.grade),
      nativeGradeArray(target.type).length,
      "Grade",
    );
  }
  if (fields.description !== undefined) {
    overrides.description = trimOrNull(
      typeof fields.description === "string" ? fields.description : null,
    );
  }
  return overrides;
}
