"use client";

import { useState } from "react";
import { AreaSearchField } from "@/components/area-search-field";
import type { AreaSuggestion } from "@/lib/search-suggestions";

export type PickedArea = AreaSuggestion;

type AreaPickerProps = {
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
};

/** Picks an existing area as a *form value* — the one place an area is
 * chosen as a field rather than as a filter or a destination. Same control
 * and same rows as every other area search; what differs is that a pick
 * binds an id (`selectedKey`), which is what the surrounding form submits.
 *
 * Typing after a selection clears it: the text no longer describes the bound
 * area, and submitting the old id while the field shows something else is
 * the kind of quiet mismatch a form should never allow. */
export function AreaPicker({ selected, onSelectedChange, isInvalid }: AreaPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? "");

  return (
    <AreaSearchField
      value={query}
      onChange={(value) => {
        setQuery(value);
        if (selected && value !== selected.name) onSelectedChange(null);
      }}
      onSelect={(area) => {
        setQuery(area.name);
        onSelectedChange(area);
      }}
      selectedKey={selected ? String(selected.id) : null}
      ariaLabel="Area"
      emptyMessage="No matching areas."
      isInvalid={isInvalid}
      inputClassName="bg-surface"
      fullWidth
    />
  );
}
