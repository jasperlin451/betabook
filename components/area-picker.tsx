"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { FormError } from "@/components/ui/form-error";
import { searchAreasForPicker } from "@/db/actions";
import type { AreaWithAncestorPath } from "@/db/queries";

export type PickedArea = { id: number; name: string; ancestorPath: string | null };

type AreaPickerProps = {
  /** Visible field label ("Area", "Parent area", …) — rendered inside the
   * combobox so react-aria wires it up as the input's accessible name. */
  label: string;
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
  /** Field-level error, rendered below the input as a `role="alert"` message
   * and associated with the input via `aria-describedby`. */
  errorMessage?: string | null;
};

/** A searchable combobox for picking an existing area by name, showing each
 * result's ancestor path to disambiguate same-named areas — the only place
 * in the app an area is chosen as a form field rather than via a whole-page
 * search. Debounces the query into `searchAreasForPicker` the same way
 * `useDebouncedReplace` debounces navigation-driven search elsewhere. */
export function AreaPicker({
  label,
  selected,
  onSelectedChange,
  isInvalid,
  errorMessage,
}: AreaPickerProps) {
  const errorId = useId();
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
      fullWidth
      isInvalid={isInvalid}
      aria-describedby={errorMessage ? errorId : undefined}
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
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Search areas..." className="bg-surface" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <FormError id={errorId}>{errorMessage}</FormError>
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
