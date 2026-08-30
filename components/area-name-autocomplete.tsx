"use client";

import { useEffect, useState, useTransition } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import type { Area, AreaBreadcrumbs } from "@/db/queries";

type AreaSuggestion = { id: number; name: string; ancestorPath: string | null };

const SUGGESTION_LIMIT = 5;

/** The Area Name filter as an autocomplete: areas are a known set, so as
 * soon as you type, real area names (with their ancestor paths, to tell
 * same-named crags apart) are offered for selection — via the public
 * search API, so it works signed out. Picking one fills the exact name;
 * free text still works — the filter matches ancestor names, so a partial
 * like "squam" keeps filtering as before. */
export function AreaNameAutocomplete({
  value,
  onChange,
  label = "Area Name",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const query = value.trim();
    if (!query) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search/areas?name=${encodeURIComponent(query)}`);
          if (!res.ok) return;
          const data: { areas: Area[]; areaBreadcrumbs: AreaBreadcrumbs } = await res.json();
          setSuggestions(
            data.areas.slice(0, SUGGESTION_LIMIT).map((area) => ({
              id: area.id,
              name: area.name,
              ancestorPath:
                (data.areaBreadcrumbs[area.id] ?? []).map((a) => a.name).join(" / ") || null,
            })),
          );
        } catch {
          // Suggestions are a convenience — a failed fetch just leaves the
          // field as plain text input.
        }
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [value]);

  const visibleSuggestions = value.trim() ? suggestions : [];

  return (
    <ComboBox<AreaSuggestion>
      fullWidth
      allowsCustomValue
      allowsEmptyCollection
      inputValue={value}
      onInputChange={onChange}
      items={visibleSuggestions}
      selectedKey={null}
      onSelectionChange={(key) => {
        const picked = suggestions.find((area) => String(area.id) === key);
        if (picked) onChange(picked.name);
      }}
    >
      <Label>{label}</Label>
      {/* No chevron trigger — suggestions open as you type, and an arrow
        * on an empty field promises a list that isn't there. */}
      <ComboBox.InputGroup>
        <Input placeholder="Search areas…" className="bg-surface" />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {(area: AreaSuggestion) => (
            <ListBox.Item id={String(area.id)} textValue={area.name}>
              <p>{area.name}</p>
              {area.ancestorPath && (
                <p className="text-muted text-xs">{area.ancestorPath}</p>
              )}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
