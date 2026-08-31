import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

type EyebrowProps = {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

/** The letterspaced micro-label that names what kind of thing a page or
 * card is about ("AREA", "CLIMB", "CLIMBER", "ASCENT BREAKDOWN") — the one
 * eyebrow treatment everywhere, replacing three near-identical inline
 * variants that disagreed on weight. */
export function Eyebrow({ icon: Icon, children, className }: EyebrowProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 text-xs font-medium tracking-widest text-muted uppercase",
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </div>
  );
}
