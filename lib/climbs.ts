import { nativeGradeArray, type ClimbType } from "@/lib/grades";
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
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    throw new Error("Name is required");
  }

  if (!isClimbType(raw.type)) {
    throw new Error("Invalid discipline");
  }
  const type = raw.type;

  if (raw.grade === null || raw.grade === "") {
    throw new Error("Grade is required");
  }
  const grade = Number(raw.grade);
  const bounds = nativeGradeArray(type).length;
  if (!Number.isInteger(grade) || grade < 0 || grade >= bounds) {
    throw new Error("Invalid grade");
  }

  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : null;

  return { name, type, grade, description };
}

export function validateNewClimbInput(raw: RawClimbInput): ClimbInput {
  return parseClimbFields(raw);
}

export function validateClimbInput(existing: Climb, raw: RawClimbInput): ClimbInput {
  const input = parseClimbFields(raw);
  if (input.type !== existing.type && existing.sendCount > 0) {
    throw new Error("Can't change discipline once a climb has logged sends");
  }
  return input;
}
