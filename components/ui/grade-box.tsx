import type { ReactNode } from "react";
import clsx from "clsx";

type GradeBoxProps = {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

/** The guidebook grade box: a grade (or grade-with-trend) set in mono
 * inside a hairline box, the way route tables print them. Content comes in
 * preformatted (formatGrade / GradeWithTrend) so composed grades keep their
 * arrows and suggestions. */
export function GradeBox({ children, size = "sm", className }: GradeBoxProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-sm border border-border bg-surface font-mono font-medium tabular-nums text-foreground",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
