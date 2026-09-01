"use client";

import { useState } from "react";
import { AreaSearchField } from "@/components/area-search-field";
import type { AreaSuggestion } from "@/lib/search-suggestions";

export type PickedArea = { id: number; name: string; ancestorPath: string | null };

type AreaPickerProps = {
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
  /** Text to start the field with when nothing is picked yet. */
  defaultQuery?: string;
};

/** The form-bound version of the shared area typeahead. Free text clears the
 * bound id, so the parent form can require an explicit existing-area pick;
 * transport, debounce, cancellation, and stale-response handling stay in the
 * same AreaSearchField/useTypeahead path as every other area search. */
export function AreaPicker({
  selected,
  onSelectedChange,
  isInvalid,
  defaultQuery,
}: AreaPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? defaultQuery ?? "");

  function handleChange(next: string) {
    setQuery(next);
    if (selected && next !== selected.name) onSelectedChange(null);
  }

  function handleSelect(area: AreaSuggestion) {
    setQuery(area.name);
    onSelectedChange(area);
  }

  return (
    <AreaSearchField
      value={query}
      onChange={handleChange}
      onSelect={handleSelect}
      selectedKey={selected ? String(selected.id) : null}
      ariaLabel="Area"
      placeholder="Search areas…"
      emptyMessage="No matching areas."
      isInvalid={isInvalid}
      fullWidth
    />
  );
}
