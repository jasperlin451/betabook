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

/** Name/discipline/grade are immutable after creation — editing a climb
 * only ever touches its description. */
export function validateClimbDescriptionInput(raw: RawClimbDescriptionInput): {
  description: string | null;
} {
  return { description: trimOrNull(raw.description) };
}

/** Full edit — name/discipline/grade/description — is moderation-exclusive
 * (see actions/moderation.ts's requestClimbEdit); the direct action only
 * ever validates the description. Discipline still can't change once sends
 * exist: that's a data-integrity rule independent of who's allowed to
 * request the edit. */
export function validateClimbEditInput(existing: Climb, raw: RawClimbInput): ClimbInput {
  const input = validateNewClimbInput(raw);
  if (input.type !== existing.type && existing.sendCount > 0) {
    throw new ActionError("Can't change discipline once a climb has logged sends");
  }
  return input;
}
