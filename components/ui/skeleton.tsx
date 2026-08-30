import clsx from "clsx";

const TONE_CLASSNAME = {
  /** Sits directly on the page background. */
  base: "bg-surface-secondary",
  /** Sits inside a bg-surface-secondary panel — one surface step up so the
   * placeholder stays visible against the panel. */
  raised: "bg-surface-tertiary",
} as const;

type SkeletonProps = {
  className?: string;
  tone?: keyof typeof TONE_CLASSNAME;
};

/** Base pulsing placeholder block — size it via className (h-*, w-*). */
export function Skeleton({ className, tone = "base" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-md", TONE_CLASSNAME[tone], className)}
    />
  );
}

/** Placeholder for a list of ListRow entries — mirrors its route-table
 * px-4 py-3 density and the divide-y separators the real lists use. */
export function SkeletonListRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y divide-separator">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 px-4 py-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a StatStrip card — the same bg-surface-secondary rounded-xl
 * panel with label/value line pairs inside. */
export function SkeletonStatCard({ stats = 3 }: { stats?: number }) {
  return (
    <div className="rounded-xl bg-surface-secondary p-4">
      <div className="flex flex-col gap-3">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <Skeleton tone="raised" className="h-3 w-24" />
            <Skeleton tone="raised" className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
