"use client";
import { AreaLookup } from "@/components/search/area-lookup";

export type PickedArea = { id: number; name: string; ancestorPath: string | null };

type AreaPickerProps = {
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
  /** Text to start the field with when nothing is picked yet. */
  defaultQuery?: string;
};

/** Free text never binds a database identity. */
export function AreaPicker({
  selected,
  onSelectedChange,
  isInvalid,
  defaultQuery,
}: AreaPickerProps) {
  return (
    <AreaLookup
      label="Area"
      value={
        selected
          ? { id: String(selected.id), name: selected.name, path: selected.ancestorPath ?? "" }
          : null
      }
      onChange={(area) =>
        onSelectedChange(
          area ? { id: Number(area.id), name: area.name, ancestorPath: area.path } : null,
        )
      }
      isInvalid={isInvalid}
      defaultQuery={defaultQuery}
    />
  );
}
