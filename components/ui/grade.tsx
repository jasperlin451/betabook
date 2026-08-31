import type { ReactNode } from "react";
import clsx from "clsx";

type GradeProps = {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

/** The one grade treatment everywhere a grade is printed: the site's own
 * face at medium weight — no box, no font change — so a grade reads the
 * same in a route row, a send row, and a climb header. */
export function Grade({ children, size = "sm", className }: GradeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-medium text-foreground",
        size === "sm" ? "text-sm" : "text-base",
        className,
      )}
    >
      {children}
    </span>
  );
}
