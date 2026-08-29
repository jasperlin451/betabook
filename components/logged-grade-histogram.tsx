import clsx from "clsx";
import type { ClimbType } from "@/lib/grades";
import type { LoggedGradeBucket } from "@/lib/grade-histogram";

// Same discipline → palette hue mapping as the area histogram's bars.
const BAR_COLOR: Record<ClimbType, string> = {
  boulder: "bg-palette-accent",
  sport: "bg-palette-support",
  trad: "bg-palette-primary",
};

/** Tallest bar in px — px (not %) so the count label above each bar hugs
 * it inside one bottom-aligned column (see grade-histogram.tsx). */
const BAR_MAX_PX = 40;

/** The community's grading of one climb: a mini histogram of every
 * suggested grade from its sends, read against the posted grade (whose
 * axis label is emphasized even when nobody voted for it). */
export function LoggedGradeHistogram({
  type,
  buckets,
}: {
  type: ClimbType;
  buckets: LoggedGradeBucket[];
}) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((b) => b.count), 1);
  const voted = buckets.filter((b) => b.count > 0);
  const summary = voted.map((b) => `${b.count} at ${b.label}`).join(", ");

  return (
    <div className="flex flex-col gap-2">
      <p className="sr-only">Logged grades: {summary}.</p>
      <div className="flex items-end gap-[3px]" aria-hidden>
        {buckets.map((bucket) => (
          <div key={bucket.label} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-14 w-full flex-col items-center justify-end gap-0.5">
              {bucket.count > 0 && (
                <>
                  <span className="font-mono text-[10px] leading-none tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
                    {bucket.count}
                  </span>
                  <div
                    className={clsx("w-full rounded-t-xs", BAR_COLOR[type])}
                    style={{ height: `${Math.max(4, Math.round((bucket.count / max) * BAR_MAX_PX))}px` }}
                  />
                </>
              )}
            </div>
            <span
              className={clsx(
                "h-3 font-mono text-[10px] leading-none",
                bucket.isPosted ? "font-semibold text-foreground underline underline-offset-2" : "text-muted",
              )}
            >
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
