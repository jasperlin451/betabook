import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

type EyebrowProps = {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

/** Small-caps icon + label row, e.g. above a page's breadcrumbs or title. */
export function Eyebrow({ icon: Icon, children, className }: EyebrowProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase",
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </div>
  );
}
