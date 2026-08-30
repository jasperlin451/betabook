"use client";

import { useEffect, useState, useTransition } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import type { Area, AreaBreadcrumbs } from "@/db/queries";

type AreaSuggestion = { id: number; name: string; ancestorPath: string | null };

const SUGGESTION_LIMIT = 5;

/** The area-scope filter as an autocomplete: labeled "In area" so it reads
 * as a constraint on the route search ("routes named X, in area Y"), not a
 * second area search. Areas are a known set, so typing offers real area
 * names (with ancestor paths, to tell same-named crags apart) via the
 * public search API — works signed out. Picking one fills the exact name;
 * free text still works — the filter matches ancestor names, so a partial
 * like "squam" keeps filtering as before. */
export function AreaNameAutocomplete({
  value,
  onChange,
  label = "In area",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();

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
      // Load-bearing: the popover only opens on input events, and the
      // suggestions arrive async after the debounce — without this the
      // menu would never open at all. The empty state below keeps the
      // open-but-empty moment informative instead of a bare sliver.
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
      {/* "Anywhere" states the default scope instead of echoing "search".
        * ComboBox.InputGroup's sibling wiring requires exactly its Input +
        * Trigger children, so the magnifier is a themed background image
        * on the input (search-combo-input) and the trigger stays in the
        * tree but hidden — typing opens the suggestions, and an arrow on
        * an empty field would promise a list that isn't there. */}
      <ComboBox.InputGroup>
        <Input placeholder="Anywhere" className="bg-surface search-combo-input" />
        <ComboBox.Trigger className="hidden" />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-muted">
              {isPending || !value.trim()
                ? "Type an area name…"
                : "No matching areas — the text still filters by area name."}
            </p>
          )}
        >
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
