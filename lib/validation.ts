export function trimOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function requireTrimmed(value: FormDataEntryValue | null, fieldName: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`${fieldName} is required`);
  return trimmed;
}

/** Parses a grade-scale index (0-based, bounded by the climb type's native
 * scale length) — the shape shared by ClimbInput.grade and
 * SendInput.suggestedGrade. `fieldName` drives both error messages, e.g.
 * "Grade" -> "Grade is required" / "Invalid grade". */
export function parseGradeIndex(
  value: FormDataEntryValue | null,
  bounds: number,
  fieldName: string,
): number {
  if (value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
  const grade = Number(value);
  if (!Number.isInteger(grade) || grade < 0 || grade >= bounds) {
    throw new Error(`Invalid ${fieldName.toLowerCase()}`);
  }
  return grade;
}

export function pickFormFields<K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, FormDataEntryValue | null> {
  const result = {} as Record<K, FormDataEntryValue | null>;
  for (const key of keys) {
    result[key] = formData.get(key);
  }
  return result;
}
