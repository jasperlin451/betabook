import type { GradeHistogram, DisciplineHistogram } from "@/lib/grade-histogram";
import type { ClimbType } from "@/lib/grades";
import { DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";

// Same discipline → palette hue mapping as the discipline chips.
const BAR_COLOR: Record<ClimbType, string> = {
  boulder: "bg-palette-accent",
  sport: "bg-palette-support",
  trad: "bg-palette-primary",
};

const GROUP_LABELS: Record<ClimbType, string> = {
  boulder: "Boulders",
  sport: "Sport",
  trad: "Trad",
};

/** Whether a bucket's grade label is printed. First and last always are;
 * short scales label everything; long ones every third, so the axis stays
 * legible without crowding. */
function showLabel(index: number, length: number): boolean {
  if (index === 0 || index === length - 1) return true;
  if (length <= 8) return true;
  return index % 3 === 0 && index < length - 2;
}

/** Tallest bar in px — px (not %) so the hover-revealed count label can sit
 * in the same bottom-aligned column and hug its bar's top. */
const BAR_MAX_PX = 56;

function barHeight(count: number, max: number): number {
  // Non-zero buckets always get a visible sliver, however tall the max is.
  return Math.max(4, Math.round((count / max) * BAR_MAX_PX));
}

function DisciplineChart({ group, delayBase }: { group: DisciplineHistogram; delayBase: number }) {
  const max = Math.max(...group.buckets.map((b) => b.count), 1);
  const voted = group.buckets.filter((b) => b.count > 0);
  // The chart itself is aria-hidden; this line, paired with the visible
  // group label, carries the full distribution for screen readers.
  const summary = voted.map((b) => `${b.count} at ${b.label}`).join(", ");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Eyebrow>{GROUP_LABELS[group.type]}</Eyebrow>
      <p className="sr-only">
        {DISCIPLINE_LABELS[group.type]} grade spread: {summary}.
      </p>
      <div className="flex items-end gap-[3px]" aria-hidden>
        {group.buckets.map((bucket, i) => (
          <div key={bucket.label} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full flex-col items-center justify-end gap-0.5">
              {bucket.count > 0 && (
                <span className="font-mono text-[10px] leading-none tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  {bucket.count}
                </span>
              )}
              {bucket.count > 0 && (
                <div
                  className={`w-full rounded-t-xs motion-safe:animate-bar-grow ${BAR_COLOR[group.type]}`}
                  style={{
                    height: `${barHeight(bucket.count, max)}px`,
                    animationDelay: `${(delayBase + i) * 40}ms`,
                  }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              )}
            </div>
            <span className="h-3 font-mono text-[10px] leading-none text-muted">
              {showLabel(i, group.buckets.length) ? bucket.label : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The crag header's signature: the subtree's grade spread as one CSS-bar
 * chart per discipline, colored by the discipline palette. Exact counts
 * reveal on hover and live in each group's screen-reader summary.
 * Server-rendered; no chart library. */
export function GradeHistogramChart({ histogram }: { histogram: GradeHistogram }) {
  if (histogram.groups.length === 0) return null;

  // Stagger continues across groups: each group's delay base is the number
  // of bars before it (prefix sum, computed without render-time mutation).
  const delayBases = histogram.groups.map((_, i) =>
    histogram.groups.slice(0, i).reduce((sum, g) => sum + g.buckets.length, 0),
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {histogram.groups.map((group, i) => (
        <DisciplineChart key={group.type} group={group} delayBase={delayBases[i]} />
      ))}
    </div>
  );
}
