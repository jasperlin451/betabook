import type { GradeHistogram } from "@/lib/grade-histogram";
import { Eyebrow } from "@/components/ui/eyebrow";

/** Whether a bucket's grade label is printed. First and last always are;
 * short scales label everything; long ones every third, so the axis stays
 * legible without crowding. */
function showLabel(index: number, length: number): boolean {
  if (index === 0 || index === length - 1) return true;
  if (length <= 8) return true;
  return index % 3 === 0 && index < length - 2;
}

/** Tallest bar in px — bars are sized in px (not %) so the count label can
 * sit in the same bottom-aligned column and hug its bar's top. */
const BAR_MAX_PX = 56;

function barHeight(count: number, max: number): number {
  // Non-zero buckets always get a visible sliver, however tall the max is.
  return Math.max(4, Math.round((count / max) * BAR_MAX_PX));
}

function BucketColumn({
  index,
  length,
  label,
  count,
  children,
}: {
  index: number;
  length: number;
  label: string;
  /** The bucket's total, printed atop its bar — the histogram is useless
   * for "how many?" without it (hover titles don't exist on touch). */
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div className="flex h-20 w-full flex-col items-center justify-end gap-0.5">
        {count > 0 && (
          <span className="font-mono text-[10px] leading-none tabular-nums text-muted">
            {count}
          </span>
        )}
        {children}
      </div>
      <span className="h-3 font-mono text-[10px] leading-none text-muted">
        {showLabel(index, length) ? label : null}
      </span>
    </div>
  );
}

/** The crag header's signature: the subtree's grade spread as CSS bars —
 * boulders by V grade, routes by number grade with sport stacked on trad,
 * colored by the discipline palette, each bar topped by its count.
 * Server-rendered; no chart library. */
export function GradeHistogramChart({ histogram }: { histogram: GradeHistogram }) {
  const groups: React.ReactNode[] = [];

  if (histogram.boulderBuckets.length > 0) {
    const max = Math.max(...histogram.boulderBuckets.map((b) => b.count), 1);
    groups.push(
      <div key="boulders" className="flex min-w-0 flex-1 flex-col gap-2">
        <Eyebrow>Boulders</Eyebrow>
        <div className="flex items-end gap-[3px]" aria-hidden>
          {histogram.boulderBuckets.map((bucket, i) => (
            <BucketColumn
              key={bucket.label}
              index={i}
              length={histogram.boulderBuckets.length}
              label={bucket.label}
              count={bucket.count}
            >
              {bucket.count > 0 && (
                <div
                  className="w-full rounded-t-xs bg-palette-accent motion-safe:animate-bar-grow"
                  style={{
                    height: `${barHeight(bucket.count, max)}px`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              )}
            </BucketColumn>
          ))}
        </div>
      </div>,
    );
  }

  if (histogram.ropeBuckets.length > 0) {
    const max = Math.max(...histogram.ropeBuckets.map((b) => b.sport + b.trad), 1);
    groups.push(
      <div key="routes" className="flex min-w-0 flex-1 flex-col gap-2">
        <Eyebrow>Routes</Eyebrow>
        <div className="flex items-end gap-[3px]" aria-hidden>
          {histogram.ropeBuckets.map((bucket, i) => {
            const total = bucket.sport + bucket.trad;
            return (
              <BucketColumn
                key={bucket.label}
                index={i}
                length={histogram.ropeBuckets.length}
                label={bucket.label}
                count={total}
              >
                {total > 0 && (
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t-xs motion-safe:animate-bar-grow"
                    style={{
                      height: `${barHeight(total, max)}px`,
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    {bucket.sport > 0 && (
                      <div
                        className="w-full bg-palette-support"
                        style={{ height: `${(bucket.sport / total) * 100}%` }}
                      />
                    )}
                    {bucket.trad > 0 && (
                      <div
                        className="w-full bg-palette-primary"
                        style={{ height: `${(bucket.trad / total) * 100}%` }}
                      />
                    )}
                  </div>
                )}
              </BucketColumn>
            );
          })}
        </div>
      </div>,
    );
  }

  if (groups.length === 0) return null;

  const summaryParts: string[] = [];
  if (histogram.boulderSpan) {
    summaryParts.push(`boulders from ${histogram.boulderSpan[0]} to ${histogram.boulderSpan[1]}`);
  }
  if (histogram.ropeSpan) {
    summaryParts.push(`routes from ${histogram.ropeSpan[0]} to ${histogram.ropeSpan[1]}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only">Grade spread: {summaryParts.join("; ")}.</p>
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">{groups}</div>
    </div>
  );
}
