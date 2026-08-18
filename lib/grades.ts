/**
 * `climbs.grade` is a plain integer ordinal: for boulder climbs it *is* the
 * index into BOULDER_HUECO; for sport/trad climbs it *is* the index into
 * ROPE_YDS. Font/French are derived via a separate conversion lookup on that
 * same index, not a parallel array, since Font/French grades don't always
 * line up 1:1 with Hueco/YDS at every step.
 *
 * The conversion tables below are representative/commonly-cited approximate
 * mappings, not sourced from one single authoritative chart — refine against
 * a verified conversion table before relying on exact precision.
 */

export type ClimbType = "boulder" | "sport" | "trad";
export type BoulderScale = "hueco" | "font";
export type RopeScale = "yds" | "french";
export type GradeScale = BoulderScale | RopeScale;

export const BOULDER_HUECO = [
  "VB",
  "V0",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V7",
  "V8",
  "V9",
  "V10",
  "V11",
  "V12",
  "V13",
  "V14",
  "V15",
  "V16",
  "V17",
] as const;

export const HUECO_TO_FONT = [
  "3",
  "4",
  "5",
  "5+",
  "6A",
  "6B",
  "6C",
  "7A",
  "7A+",
  "7B",
  "7C",
  "7C+",
  "8A",
  "8A+",
  "8B",
  "8B+",
  "8C",
  "8C+",
  "9A",
] as const;

export const ROPE_YDS = [
  "5.0",
  "5.1",
  "5.2",
  "5.3",
  "5.4",
  "5.5",
  "5.6",
  "5.7",
  "5.8",
  "5.9",
  "5.10a",
  "5.10b",
  "5.10c",
  "5.10d",
  "5.11a",
  "5.11b",
  "5.11c",
  "5.11d",
  "5.12a",
  "5.12b",
  "5.12c",
  "5.12d",
  "5.13a",
  "5.13b",
  "5.13c",
  "5.13d",
  "5.14a",
  "5.14b",
  "5.14c",
  "5.14d",
  "5.15a",
  "5.15b",
  "5.15c",
  "5.15d",
] as const;

export const YDS_TO_FRENCH = [
  "1",
  "1+",
  "2",
  "2+",
  "3",
  "4a",
  "4c",
  "5a",
  "5b",
  "5c",
  "6a",
  "6a+",
  "6b",
  "6b+",
  "6c",
  "6c+",
  "7a",
  "7a+",
  "7a+",
  "7b",
  "7b+",
  "7c",
  "7c+",
  "8a",
  "8a+",
  "8b",
  "8b+",
  "8c",
  "8c+",
  "9a",
  "9a+",
  "9b",
  "9b+",
  "9c",
] as const;

function disciplineFor(type: ClimbType): "boulder" | "rope" {
  return type === "boulder" ? "boulder" : "rope";
}

/** Ordinal→text array for a climb type in its native scale (Hueco or YDS). */
export function nativeGradeArray(type: ClimbType): readonly string[] {
  return disciplineFor(type) === "boulder" ? BOULDER_HUECO : ROPE_YDS;
}

export function formatGrade(
  type: ClimbType,
  grade: number | null | undefined,
  scale: GradeScale = disciplineFor(type) === "boulder" ? "hueco" : "yds",
): string {
  if (grade == null) return "Grade unknown";

  const discipline = disciplineFor(type);
  const native = discipline === "boulder" ? BOULDER_HUECO : ROPE_YDS;
  const converted = discipline === "boulder" ? HUECO_TO_FONT : YDS_TO_FRENCH;

  const isNativeScale = scale === "hueco" || scale === "yds";
  const table = isNativeScale ? native : converted;

  return table[grade] ?? "Grade unknown";
}
