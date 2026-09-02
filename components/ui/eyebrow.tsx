import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The letterspaced micro-label treatment, as a class for inline spots
 * (stat labels, list section headings) that can't take the block element. */
export const EYEBROW_CLASS = "text-xs font-medium tracking-widest text-muted uppercase";

type EyebrowProps = {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

/** The letterspaced micro-label that names what kind of thing a page or
 * card is about ("AREA", "CLIMB", "CLIMBER", "ASCENT BREAKDOWN") — the one
 * eyebrow treatment everywhere. */
export function Eyebrow({ icon: Icon, children, className }: EyebrowProps) {
  return (
    <div className={clsx("flex items-center gap-2", EYEBROW_CLASS, className)}>
      {Icon && <Icon className="size-4" />}
      {children}
    </div>
  );
}
