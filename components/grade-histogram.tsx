import type { GradeHistogram, DisciplineHistogram, GradeBucket } from "@/lib/grade-histogram";
import type { ClimbType } from "@/lib/grades";
import {
  areaClimbsFilterToSearchParams,
  DEFAULT_AREA_CLIMBS_FILTER,
  DEFAULT_AREA_CLIMBS_SORT,
} from "@/lib/area-climbs-filter";
import { formatCount } from "@/lib/format";
import { AppLink } from "@/components/ui/app-link";
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

/** The area-page URL that filters the climb list to exactly this bucket:
 * its discipline checked, its grade span selected, everything else at the
 * defaults. */
function bucketFilterHref(areaId: number, type: ClimbType, bucket: GradeBucket): string {
  const filter = { ...DEFAULT_AREA_CLIMBS_FILTER, disciplines: [type] };
  if (type === "boulder") filter.boulderRange = bucket.range;
  else if (type === "sport") filter.sportRange = bucket.range;
  else filter.tradRange = bucket.range;
  return `/areas/${areaId}?${areaClimbsFilterToSearchParams(DEFAULT_AREA_CLIMBS_SORT, filter).toString()}`;
}

function BucketColumn({
  index,
  length,
  count,
  label,
  children,
}: {
  index: number;
  length: number;
  count: number;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-20 w-full flex-col items-center justify-end gap-0.5">
        {count > 0 && (
          <span
            aria-hidden
            className="text-[10px] leading-none tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {count}
          </span>
        )}
        {children}
      </div>
      <span aria-hidden className="h-3 text-[10px] leading-none text-muted">
        {showLabel(index, length) ? label : null}
      </span>
    </>
  );
}

function DisciplineChart({
  areaId,
  group,
  delayBase,
}: {
  areaId: number;
  group: DisciplineHistogram;
  delayBase: number;
}) {
  const max = Math.max(...group.buckets.map((b) => b.count), 1);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Eyebrow>{GROUP_LABELS[group.type]}</Eyebrow>
      <div className="flex items-end gap-[3px]">
        {group.buckets.map((bucket, i) => {
          const bar = bucket.count > 0 && (
            <div
              aria-hidden
              className={`w-full rounded-t-xs motion-safe:animate-bar-grow ${BAR_COLOR[group.type]}`}
              style={{
                height: `${barHeight(bucket.count, max)}px`,
                animationDelay: `${(delayBase + i) * 40}ms`,
              }}
              title={`${bucket.label}: ${bucket.count}`}
            />
          );

          // A voted bucket is a link that filters the climb list below to
          // exactly this discipline + grade span; empty buckets are inert
          // spacers that keep the axis contiguous.
          return bucket.count > 0 ? (
            <AppLink
              key={bucket.label}
              href={bucketFilterHref(areaId, group.type, bucket)}
              aria-label={`Show ${formatCount(bucket.count, `${DISCIPLINE_LABELS[group.type]} climb`)} at ${bucket.label}`}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1 no-underline"
            >
              <BucketColumn index={i} length={group.buckets.length} count={bucket.count} label={bucket.label}>
                {bar}
              </BucketColumn>
            </AppLink>
          ) : (
            <div
              key={bucket.label}
              aria-hidden
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <BucketColumn index={i} length={group.buckets.length} count={0} label={bucket.label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The crag header's signature: the subtree's grade spread as one CSS-bar
 * chart per discipline, colored by the discipline palette. Every bar is a
 * link that applies the matching discipline + grade filter to the climb
 * list; exact counts reveal on hover/focus and via each link's label.
 * Server-rendered; no chart library. */
export function GradeHistogramChart({
  histogram,
  areaId,
}: {
  histogram: GradeHistogram;
  areaId: number;
}) {
  if (histogram.groups.length === 0) return null;

  // Stagger continues across groups: each group's delay base is the number
  // of bars before it (prefix sum, computed without render-time mutation).
  const delayBases = histogram.groups.map((_, i) =>
    histogram.groups.slice(0, i).reduce((sum, g) => sum + g.buckets.length, 0),
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {histogram.groups.map((group, i) => (
        <DisciplineChart key={group.type} areaId={areaId} group={group} delayBase={delayBases[i]} />
      ))}
    </div>
  );
}
