import type { ReactNode } from "react";
import type { Area } from "@/db/queries";
import type { AreaClimbsFilter } from "@/lib/area-climbs-filter";
import type { GradeHistogram } from "@/lib/grade-histogram";
import { formatCount } from "@/lib/format";
import { GradeHistogramChart } from "@/components/grade-histogram";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageTitle } from "@/components/ui/typography";

/** The guidebook crag header: entity eyebrow, display-face name,
 * description, a mono info strip (climb count, grade spans, disciplines),
 * and the grade-spread histogram — everything a climber skims before
 * deciding to scroll the route table. */
export function AreaCragHeader({
  area,
  histogram,
  actions,
  isEditor = false,
  filter,
}: {
  area: Area;
  histogram: GradeHistogram;
  /** The area's "…" actions menu, rendered beside the title (editors only). */
  actions?: ReactNode;
  /** Signed-in viewers get invited to fill a missing description — everyone
   * else just sees that there isn't one yet. */
  isEditor?: boolean;
  /** The page's active climb filter — lets an applied histogram bucket
   * render selected and toggle clear on click. */
  filter?: AreaClimbsFilter;
}) {
  const spans: string[] = [];
  if (histogram.boulderSpan) spans.push(`${histogram.boulderSpan[0]}–${histogram.boulderSpan[1]}`);
  if (histogram.ropeSpan) spans.push(`${histogram.ropeSpan[0]}–${histogram.ropeSpan[1]}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Eyebrow>Area</Eyebrow>
          <PageTitle>{area.name}</PageTitle>
          <p className="text-muted mt-1">
            {area.description ||
              (isEditor ? "No description yet — add one from the ⋯ menu." : "No description yet.")}
          </p>
        </div>
        {actions}
      </div>

      {histogram.totalClimbs > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span className="text-foreground">{formatCount(histogram.totalClimbs, "climb")}</span>
          {spans.map((span) => (
            <span key={span}>{span}</span>
          ))}
          {histogram.ungradedCount > 0 && (
            <span>{formatCount(histogram.ungradedCount, "ungraded climb")}</span>
          )}
          <span className="flex items-center gap-1.5">
            {histogram.disciplines.map((d) => (
              <DisciplineChip key={d} type={d} />
            ))}
          </span>
        </div>
      )}

      <GradeHistogramChart histogram={histogram} areaId={area.id} filter={filter} />
    </div>
  );
}
