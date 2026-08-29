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

type SidebarLayoutProps = {
  /** The filter/stat column. On narrow screens it stacks above the main
   * content (filters lead); from lg it becomes a fixed-width side column. */
  sidebar: ReactNode;
  children: ReactNode;
  /** Tailwind width classes for the sidebar column at lg+ ("lg:w-80"). */
  sidebarWidthClass?: string;
  /** Which side the sidebar sits on at lg+. */
  side?: "left" | "right";
  className?: string;
};

/** The two-column entity-page layout (area, user) — one shared
 * implementation of the stack-then-split pattern that used to be
 * hand-rolled per page with diverging order-* classes. */
export function SidebarLayout({
  sidebar,
  children,
  sidebarWidthClass = "lg:w-80",
  side = "right",
  className,
}: SidebarLayoutProps) {
  return (
    <div className={clsx("flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8", className)}>
      <div
        className={clsx(
          "flex min-w-0 flex-1 flex-col gap-6",
          side === "right" ? "order-2 lg:order-1" : "order-2",
        )}
      >
        {children}
      </div>
      <div
        className={clsx(
          "order-1 flex flex-col gap-4 lg:shrink-0",
          side === "right" && "lg:order-2",
          sidebarWidthClass,
        )}
      >
        {sidebar}
      </div>
    </div>
  );
}

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
