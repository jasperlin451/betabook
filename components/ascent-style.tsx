import { Chip } from "@heroui/react";
import type { AscentStyle } from "@/lib/sends";

/** One shared sentence-case label map — the same names everywhere an
 * ascent style is written out (chips here, the climb page's breakdown,
 * the import wizard's value mapping). */
export const ASCENT_STYLE_LABELS: Record<AscentStyle, string> = {
  onsight: "Onsight",
  flash: "Flash",
  redpoint: "Redpoint",
};

// Ordered best-to-baseline: onsight (first try, no info) > flash (first
// try, with info) > redpoint (after prior attempts). Redpoint is the
// everyday baseline, not a failure state, so it stays on the neutral chip
// color; onsight gets the palette green; flash gets a support-blue tint
// (via the --ascent-flash-* tokens in globals.css) instead of HeroUI's
// amber, which the rating stars own.
const ASCENT_STYLE_CHIP_COLOR: Record<AscentStyle, "success" | "default"> = {
  onsight: "success",
  flash: "default",
  redpoint: "default",
};

const ASCENT_STYLE_CHIP_CLASSNAME: Record<AscentStyle, string | undefined> = {
  onsight: undefined,
  flash: "bg-(--ascent-flash-bg) text-(--ascent-flash-fg)",
  redpoint: undefined,
};

export function AscentStyle({ type }: { type: AscentStyle }) {
  return (
    <Chip
      color={ASCENT_STYLE_CHIP_COLOR[type]}
      variant="soft"
      size="sm"
      className={ASCENT_STYLE_CHIP_CLASSNAME[type]}
    >
      {ASCENT_STYLE_LABELS[type]}
    </Chip>
  );
}
