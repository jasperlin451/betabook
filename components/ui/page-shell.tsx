import type { ReactNode } from "react";
import clsx from "clsx";

type PageWithStatsProps = {
  /** Typically a <StatStrip>. Omit entirely for single-column pages. */
  stats?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Where the stats land relative to the content on narrow screens, where
   * they stack into a single column (desktop is always a side-by-side row
   * regardless of this setting). Default "after" puts stats below the
   * content, like a footer summary. */
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
          reordered && "order-2 lg:order-1",
        )}
      >
        {children}
      </div>
      <div className={clsx(reordered && "order-1 lg:order-2")}>{stats}</div>
    </div>
  );
}
