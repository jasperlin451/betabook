import type { ReactNode } from "react";
import clsx from "clsx";

/** The guidebook display voice (Barlow Condensed) for page h1s — one
 * canonical treatment so content pages and card pages stop disagreeing
 * about what an h1 looks like. */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={clsx("font-display text-3xl font-semibold tracking-tight", className)}>
      {children}
    </h1>
  );
}

/** Canonical section h2 ("Results", "Climbs", "Sends", …). */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={clsx("text-lg font-semibold", className)}>{children}</h2>;
}

/** Figures set like a guidebook table: grades, counts, dates, spans. Mono
 * with lining figures so columns of numbers align. */
export function DataMono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("font-mono text-sm tabular-nums", className)}>{children}</span>;
}
