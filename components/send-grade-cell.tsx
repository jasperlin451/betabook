import { Grade, GradeArrow } from "@/components/ui/grade";
import { RatingStars } from "@/components/ui/rating-stars";
import { formatGrade } from "@/lib/grades";
import type { ClimbType } from "@/lib/grades";
import type { GradeFeel } from "@/lib/sends";

type SendGradeCellProps = {
  type: ClimbType;
  /** The grade the row leads with — the climb's posted grade in a feed or
   * logbook row, the climber's own suggested grade on a climb page where
   * the posted grade is already the headline. */
  grade: number | null;
  /** The climber's suggested grade, shown in parentheses when it differs
   * from `grade`. Omit where `grade` already is the suggestion. */
  suggestedGrade?: number | null;
  gradeFeel: GradeFeel;
  rating: number | null;
};

/** The grade line of a send row — grade, the climber's differing suggestion,
 * how it felt, and their stars — shared by every list of sends so the three
 * places a send is printed can't drift. */
export function SendGradeCell({
  type,
  grade,
  suggestedGrade,
  gradeFeel,
  rating,
}: SendGradeCellProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Grade>
        {formatGrade(type, grade)}
        {suggestedGrade != null && suggestedGrade !== grade && (
          <span className="font-normal text-muted"> ({formatGrade(type, suggestedGrade)})</span>
        )}
        {gradeFeel === "high" && <GradeArrow direction="up" label="Felt hard for the grade" />}
        {gradeFeel === "low" && <GradeArrow direction="down" label="Felt soft for the grade" />}
      </Grade>
      <RatingStars rating={rating} />
    </div>
  );
}
