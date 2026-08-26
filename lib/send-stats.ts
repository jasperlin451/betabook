import { ASCENT_STYLES, GRADE_FEEL_OFFSET, type AscentStyle, type GradeFeel } from "@/lib/sends";
import type { Send } from "@/db/queries";

export function averageRating(sends: Pick<Send, "rating">[]): number | null {
  const rated = sends.map((s) => s.rating).filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

/** Same gradeFeel-weighted consensus as getClimbSendStats's SQL aggregate
 * (db/queries/sends.ts), computed in memory here since the caller (the climb
 * detail page) already has every Send row loaded via getSendsForClimb. */
export function averageSuggestedGrade(
  sends: Pick<Send, "suggestedGrade" | "gradeFeel">[],
): number | null {
  const values = sends
    .filter((s): s is { suggestedGrade: number; gradeFeel: GradeFeel } => s.suggestedGrade != null)
    .map((s) => s.suggestedGrade + GRADE_FEEL_OFFSET[s.gradeFeel]);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
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
