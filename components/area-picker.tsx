"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { searchAreasForPicker } from "@/db/actions";
import type { AreaWithAncestorPath } from "@/db/queries";

export type PickedArea = { id: number; name: string; ancestorPath: string | null };

type AreaPickerProps = {
  selected: PickedArea | null;
  onSelectedChange: (area: PickedArea | null) => void;
  isInvalid?: boolean;
};

/** The most recent search to finish, tagged with the query it answered so a
 * finished-but-stale outcome can be told apart from one for the current text. */
type SearchOutcome = { query: string; ok: boolean };

/** A searchable combobox for picking an existing area by name, showing each
 * result's ancestor path to disambiguate same-named areas — the only place
 * in the app an area is chosen as a form field rather than via a whole-page
 * search. Debounces the query into `searchAreasForPicker` the same way
 * `useDebouncedReplace` debounces navigation-driven search elsewhere. */
export function AreaPicker({ selected, onSelectedChange, isInvalid }: AreaPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [results, setResults] = useState<AreaWithAncestorPath[]>([]);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Monotonic search generation. Server actions can't be aborted, so stale
  // responses are dropped instead: a response only commits if its generation
  // is still current. Every query (or gating selection) change starts a new
  // generation — not just the next fired search — so an in-flight response
  // can't slip in during the next search's debounce window either.
  const searchSeq = useRef(0);

  useEffect(() => {
    const seq = ++searchSeq.current;
    if (!query.trim()) return;
    // The input showing the picked area's name isn't a new search — it's the
    // result of picking. Searching it again would waste a round trip.
    if (selected && query === selected.name) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const found = await searchAreasForPicker(query);
          if (seq !== searchSeq.current) return;
          setResults(found);
          setOutcome({ query, ok: true });
        } catch {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setOutcome({ query, ok: false });
        }
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  // A pick is only valid while the input still shows the picked area's name:
  // editing the text afterwards means the field no longer says what the form
  // would submit, so drop the selection (both parent forms already treat "no
  // selection" as not-yet-valid).
  useEffect(() => {
    if (selected && query !== selected.name) onSelectedChange(null);
  }, [query, selected, onSelectedChange]);

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery ? results : [];
  // The input showing the picked area's name needs no search (see the effect
  // above), so it doesn't count as unanswered.
  const pickIsCurrent = selected != null && query === selected.name;
  // "Searching" spans the debounce window plus the in-flight request: any
  // typed text the latest finished search hasn't answered yet.
  const searching =
    Boolean(trimmedQuery) && !pickIsCurrent && (isPending || outcome?.query !== query);
  const searchFailed = !searching && outcome?.ok === false && outcome.query === query;

  function clear() {
    setQuery("");
    setResults([]);
    onSelectedChange(null);
    inputRef.current?.focus();
  }

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
        const picked = visibleResults.find((a) => String(a.id) === key) ?? null;
        onSelectedChange(
          picked ? { id: picked.id, name: picked.name, ancestorPath: picked.ancestorPath } : null,
        );
        if (picked) setQuery(picked.name);
      }}
    >
      <ComboBox.InputGroup>
        <Input ref={inputRef} placeholder="Search areas..." className="bg-surface pr-12" />
        {(query || selected) && (
          // The group's chevron trigger is absolutely positioned over the
          // input's right edge; sit just left of it so both stay clickable.
          <button
            type="button"
            aria-label="Clear area"
            onClick={clear}
            className="text-muted hover:text-foreground absolute top-1/2 right-6 -translate-y-1/2 px-1 text-base leading-none"
          >
            &times;
          </button>
        )}
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        {searching && <p className="text-muted px-3 py-2 text-xs">Searching&hellip;</p>}
        {searchFailed && (
          <p className="text-danger px-3 py-2 text-sm">Search failed &mdash; try again.</p>
        )}
        <ListBox
          renderEmptyState={() =>
            trimmedQuery && !searching && !searchFailed ? (
              <p className="text-muted px-3 py-2 text-sm">No matching areas.</p>
            ) : null
          }
        >
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
