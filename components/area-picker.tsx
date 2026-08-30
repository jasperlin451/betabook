"use client";

import { useEffect, useState, useTransition } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { searchAreasForPicker } from "@/db/actions";
import type { AreaWithAncestorPath } from "@/db/queries";

export type PickedArea = { id: number; name: string; ancestorPath: string | null };

type AreaPickerProps = {
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
};

/** A searchable combobox for picking an existing area by name, showing each
 * result's ancestor path to disambiguate same-named areas — the only place
 * in the app an area is chosen as a form field rather than via a whole-page
 * search. Debounces the query into `searchAreasForPicker` the same way
 * `useDebouncedReplace` debounces navigation-driven search elsewhere. */
export function AreaPicker({ selected, onSelectedChange, isInvalid }: AreaPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [results, setResults] = useState<AreaWithAncestorPath[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchAreasForPicker(query));
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  return (
    <ComboBox<AreaWithAncestorPath>
      aria-label="Area"
      fullWidth
      isInvalid={isInvalid}
      allowsEmptyCollection
      inputValue={query}
      onInputChange={setQuery}
      items={visibleResults}
      selectedKey={selected ? String(selected.id) : null}
      onSelectionChange={(key) => {
        const picked = results.find((a) => String(a.id) === key) ?? null;
        onSelectedChange(
          picked ? { id: picked.id, name: picked.name, ancestorPath: picked.ancestorPath } : null,
        );
        if (picked) setQuery(picked.name);
      }}
    >
      <ComboBox.InputGroup>
        <Input placeholder="Search areas…" className="bg-surface" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {(area: AreaWithAncestorPath) => (
            <ListBox.Item id={String(area.id)} textValue={area.name}>
              <p>{area.name}</p>
              {area.ancestorPath && (
                <p className="text-muted text-xs">Parent: {area.ancestorPath}</p>
              )}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
