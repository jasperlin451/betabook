import type { ReactNode } from "react";
import clsx from "clsx";
import { cardClass } from "@/components/ui/card";
import { EYEBROW_CLASS } from "@/components/ui/eyebrow";

export type StatTile = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
};

/** The analytics page's headline numbers: a responsive grid of small cards,
 * each one stat — display-face value, letterspaced label, muted footnote.
 * Callers pick the column classes, since the tile rows differ in width. */
export function StatTiles({ tiles, className }: { tiles: StatTile[]; className?: string }) {
  if (tiles.length === 0) return null;

  return (
    <div className={clsx("grid gap-3", className)}>
      {tiles.map((tile) => (
        <div key={tile.label} className={clsx("flex flex-col gap-1", cardClass("sm"))}>
          <span className={EYEBROW_CLASS}>{tile.label}</span>
          <span className="font-display text-2xl font-semibold text-foreground tabular-nums">
            {tile.value}
          </span>
          {tile.sub != null && <span className="text-xs text-muted">{tile.sub}</span>}
        </div>
      ))}
    </div>
  );
}
