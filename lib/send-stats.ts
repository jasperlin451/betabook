import { formatGrade, type ClimbType } from "@/lib/grades";
import { ASCENT_STYLES, type AscentStyle } from "@/lib/sends";
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

export function ascentStyleBreakdown(
  sends: Pick<Send, "ascentStyle">[],
): Record<AscentStyle, number> {
  const breakdown = Object.fromEntries(
    ASCENT_STYLES.map((style) => [style, 0]),
  ) as Record<AscentStyle, number>;
  for (const send of sends) {
    breakdown[send.ascentStyle]++;
  }
  return breakdown;
}
