import { Chip } from "@heroui/react";
import type { CompletionType } from "@/lib/sends";

// Ordered best-to-baseline: onsight (first try, no info) > flash (first
// try, with info) > redpoint (after prior attempts).
const COMPLETION_CHIP_COLOR: Record<CompletionType, "success" | "warning" | "danger"> = {
  onsight: "success",
  flash: "warning",
  redpoint: "danger",
};

export function AscentType({ type }: { type: CompletionType }) {
  return (
    <Chip color={COMPLETION_CHIP_COLOR[type]} variant="primary" size="sm">
      {type.toUpperCase()}
    </Chip>
  );
}
