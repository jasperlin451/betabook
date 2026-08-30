import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import { ActionError } from "@/lib/action-result";
import { parseGradeIndex, requireTrimmed, trimOrNull } from "@/lib/validation";
import type { Climb } from "@/db/queries";

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

function isClimbType(value: FormDataEntryValue | null): value is ClimbType {
  return typeof value === "string" && (CLIMB_TYPES as readonly string[]).includes(value);
}

function parseClimbFields(raw: RawClimbInput): ClimbInput {
  const name = requireTrimmed(raw.name, "Name");

  if (!isClimbType(raw.type)) {
    throw new ActionError("Invalid discipline");
  }
  const type = raw.type;

  const grade = parseGradeIndex(raw.grade, nativeGradeArray(type).length, "Grade");
  const description = trimOrNull(raw.description);

  return { name, type, grade, description };
}

export function validateNewClimbInput(raw: RawClimbInput): ClimbInput {
  return parseClimbFields(raw);
}

export function validateClimbInput(existing: Climb, raw: RawClimbInput): ClimbInput {
  const input = parseClimbFields(raw);
  if (input.type !== existing.type && existing.sendCount > 0) {
    throw new ActionError("Can't change discipline once a climb has logged sends");
  }
  return input;
}
