import { Chip } from "@heroui/react";
import type { AscentStyle } from "@/lib/sends";

// Ordered best-to-baseline: onsight (first try, no info) > flash (first
// try, with info) > redpoint (after prior attempts).
const ASCENT_STYLE_CHIP_COLOR: Record<AscentStyle, "success" | "warning" | "danger"> = {
  onsight: "success",
  flash: "warning",
  redpoint: "danger",
};

export function AscentStyle({ type }: { type: AscentStyle }) {
  return (
    <Chip color={ASCENT_STYLE_CHIP_COLOR[type]} variant="soft" size="sm">
      {type.toUpperCase()}
    </Chip>
  );
}
