import { Chip } from "@heroui/react";
import type { AscentStyle } from "@/lib/sends";

// Ordered best-to-baseline: onsight (first try, no info) > flash (first
// try, with info) > redpoint (after prior attempts). Redpoint is the
// everyday baseline, not a failure state, so it stays on the neutral chip
// color — success/warning only call out the standout first-try styles.
const ASCENT_STYLE_CHIP_COLOR: Record<AscentStyle, "success" | "warning" | "default"> = {
  onsight: "success",
  flash: "warning",
  redpoint: "default",
};

export function AscentStyle({ type }: { type: AscentStyle }) {
  return (
    <Chip color={ASCENT_STYLE_CHIP_COLOR[type]} variant="soft" size="sm" className="capitalize">
      {type}
    </Chip>
  );
}
