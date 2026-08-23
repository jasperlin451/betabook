import type { ReactNode } from "react";
import clsx from "clsx";

type PageWithStatsProps = {
  /** Typically a <StatStrip>. Omit entirely for single-column pages. */
  stats?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Where the stats land relative to the content, both stacked (narrow
   * screens) and side-by-side (wide screens) — "before" puts stats above/
   * left of the content, "after" (default) puts them below/right, like a
   * footer summary. */
  statsPosition?: "before" | "after";
};

export function PageWithStats({
  stats,
  children,
  className,
  statsPosition = "after",
}: PageWithStatsProps) {
  if (!stats) {
    return <div className={clsx("flex flex-col gap-6", className)}>{children}</div>;
  }

  const reordered = statsPosition === "before";

  return (
    <div className={clsx("flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8", className)}>
      <div
        className={clsx(
          "flex min-w-0 flex-1 flex-col gap-6",
          reordered && "order-2",
        )}
      >
        {children}
      </div>
      <div className={clsx(reordered && "order-1")}>{stats}</div>
    </div>
  );
}
