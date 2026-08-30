import clsx from "clsx";
import type { ClimbType } from "@/lib/grades";
import type { LoggedGradeBucket } from "@/lib/grade-histogram";

// Same discipline → palette hue mapping as the discipline chips; slices
// step down in opacity so one hue yields distinct, theme-adaptive shades.
const PIE_COLOR: Record<ClimbType, string> = {
  boulder: "var(--color-palette-accent)",
  sport: "var(--color-palette-support)",
  trad: "var(--color-palette-primary)",
};

const SLICE_OPACITY = [1, 0.72, 0.5, 0.34, 0.22];

function sliceOpacity(index: number): number {
  return SLICE_OPACITY[index % SLICE_OPACITY.length];
}

/** The community's grading of one climb: a donut of every suggested grade
 * from its sends, with a legend carrying the exact share — read against
 * the posted grade, which the legend marks even when nobody voted for it. */
export function LoggedGradeHistogram({
  type,
  buckets,
}: {
  type: ClimbType;
  buckets: LoggedGradeBucket[];
}) {
  const voted = buckets.filter((b) => b.count > 0);
  if (voted.length === 0) return null;

  const total = voted.reduce((sum, b) => sum + b.count, 0);
  const posted = buckets.find((b) => b.isPosted);
  const hue = PIE_COLOR[type];

  const summary = voted
    .map((b) => `${Math.round((b.count / total) * 100)}% at ${b.label}`)
    .join(", ");

  // Donut slices: one circle per bucket on a circumference normalized to
  // 100, dashed to its percentage share; 25 rotates the start to 12
  // o'clock. Each slice starts where the previous ones end (prefix sum,
  // computed without render-time mutation).
  const pcts = voted.map((bucket) => (bucket.count / total) * 100);
  const starts = pcts.map((_, i) => pcts.slice(0, i).reduce((sum, p) => sum + p, 0));
  const slices = voted.map((bucket, i) => (
    <circle
      key={bucket.label}
      cx="21"
      cy="21"
      r="15.915"
      fill="none"
      stroke={hue}
      strokeOpacity={sliceOpacity(i)}
      strokeWidth="9"
      strokeDasharray={`${pcts[i]} ${100 - pcts[i]}`}
      strokeDashoffset={25 - starts[i]}
    />
  ));

  return (
    <div className="flex items-center gap-4">
      <p className="sr-only">
        Logged grades: {summary}.{posted ? ` Posted grade: ${posted.label}.` : ""}
      </p>
      <svg viewBox="0 0 42 42" className="size-20 shrink-0 -rotate-0" aria-hidden>
        {slices}
      </svg>
      <ul className="flex flex-col gap-1" aria-hidden>
        {voted.map((bucket, i) => (
          <li key={bucket.label} className="flex items-center gap-2 font-mono text-xs tabular-nums">
            <span
              className="size-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: hue, opacity: sliceOpacity(i) }}
            />
            <span
              className={clsx(
                bucket.isPosted
                  ? "font-semibold text-foreground underline underline-offset-2"
                  : "text-foreground",
              )}
            >
              {bucket.label}
            </span>
            <span className="text-muted">
              {Math.round((bucket.count / total) * 100)}% · {bucket.count}
            </span>
          </li>
        ))}
        {posted && posted.count === 0 && (
          <li className="flex items-center gap-2 font-mono text-xs tabular-nums">
            <span className="size-2.5 shrink-0" />
            <span className="font-semibold text-foreground underline underline-offset-2">
              {posted.label}
            </span>
            <span className="text-muted">posted · no votes</span>
          </li>
        )}
      </ul>
    </div>
  );
}
