import { formatGrade, type ClimbType } from "@/lib/grades";
import { COMPLETION_TYPES, type CompletionType } from "@/lib/sends";
import type { Send } from "@/db/queries";

export function averageRating(sends: Pick<Send, "rating">[]): number | null {
  const rated = sends.map((s) => s.rating).filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

export type SuggestedGradeRange = { min: string; max: string };

export function suggestedGradeRange(
  sends: Pick<Send, "suggestedGrade">[],
  climbType: ClimbType,
): SuggestedGradeRange | null {
  const grades = sends.map((s) => s.suggestedGrade).filter((g): g is number => g != null);
  if (grades.length === 0) return null;
  return {
    min: formatGrade(climbType, Math.min(...grades)),
    max: formatGrade(climbType, Math.max(...grades)),
  };
}

export function ascentTypeBreakdown(
  sends: Pick<Send, "completionType">[],
): Record<CompletionType, number> {
  const breakdown = Object.fromEntries(
    COMPLETION_TYPES.map((type) => [type, 0]),
  ) as Record<CompletionType, number>;
  for (const send of sends) {
    breakdown[send.completionType]++;
  }
  return breakdown;
}
