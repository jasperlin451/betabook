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
  /** Text to start the field with when nothing is picked yet — carried over
   * from a search that came up empty, so the area doesn't have to be retyped.
   * A starting point only; picking is still what binds an area. */
  defaultQuery?: string;
};

/** How the current text's search ended, or `null` while it has no answer yet
 * — reset the moment the text changes, so it always describes what the input
 * says now rather than what it said when some earlier search finished. */
type SearchStatus = "ok" | "failed";

/** A searchable combobox for picking an existing area by name, showing each
 * result's ancestor path to disambiguate same-named areas — the only place
 * in the app an area is chosen as a form field rather than via a whole-page
 * search. Debounces the query into `searchAreasForPicker` the same way
 * `useDebouncedReplace` debounces navigation-driven search elsewhere. */
export function AreaPicker({
  selected,
  onSelectedChange,
  isInvalid,
  defaultQuery,
}: AreaPickerProps) {
  const [query, setQuery] = useState(selected?.name ?? defaultQuery ?? "");
  const [results, setResults] = useState<AreaWithAncestorPath[]>([]);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  // Bumped to re-run the search effect for text that hasn't changed, which is
  // the only way a failed search gets a second attempt.
  const [retryToken, setRetryToken] = useState(0);
  const [, startTransition] = useTransition();
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
          setStatus("ok");
        } catch {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setStatus("failed");
        }
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, selected, retryToken]);

  // A pick is only valid while the input still shows the picked area's name:
  // editing the text afterwards means the field no longer says what the form
  // would submit, so drop the selection. Both parent forms refuse to submit
  // without a selection, so this can only cost a re-pick, never a silent
  // substitution of some other value for the one that was picked.
  useEffect(() => {
    if (selected && query !== selected.name) onSelectedChange(null);
  }, [query, selected, onSelectedChange]);

  const trimmedQuery = query.trim();
  // The input showing the picked area's name needs no search (see the effect
  // above), so it doesn't count as unanswered.
  const pickIsCurrent = selected != null && query === selected.name;
  // `results` answers whatever text was in the field when the search that
  // filled it was fired, so it's only offerable once this text has an answer
  // of its own — React Aria does no filtering of its own while `items` is
  // controlled, so handing it the previous query's areas would leave them
  // selectable under the "Searching..." row. A current pick is the exception:
  // its search is skipped, and dropping the selected item out of `items`
  // leaves React Aria unable to resolve `selectedKey` against the collection,
  // which makes it clear the selection on blur.
  const visibleResults = trimmedQuery && (status === "ok" || pickIsCurrent) ? results : [];
  // "Searching" spans the debounce window plus the in-flight request: typed
  // text with no answer yet.
  const searching = Boolean(trimmedQuery) && !pickIsCurrent && status === null;
  const searchFailed = status === "failed";

  /** Every path that changes the text goes through here, so a search can't
   * outlive the text it answered: React Aria routes its own edits (typing,
   * committing a pick) through `onInputChange` while `inputValue` is
   * controlled, and `clear` is the only other writer. Resetting here rather
   * than in the search effect matters — an effect runs after paint, which
   * would leave one frame showing the old answer against the new text. */
  function retype(next: string) {
    setQuery(next);
    setStatus(null);
  }

  function clear() {
    retype("");
    onSelectedChange(null);
    inputRef.current?.focus();
  }

  function retry() {
    setStatus(null);
    setRetryToken((token) => token + 1);
  }

  return (
    <ComboBox<AreaWithAncestorPath>
      aria-label="Area"
      fullWidth
      isInvalid={isInvalid}
      allowsEmptyCollection
      inputValue={query}
      onInputChange={retype}
      items={visibleResults}
      selectedKey={selected ? String(selected.id) : null}
      onSelectionChange={(key) => {
        const picked = visibleResults.find((a) => String(a.id) === key) ?? null;
        onSelectedChange(
          picked ? { id: picked.id, name: picked.name, ancestorPath: picked.ancestorPath } : null,
        );
        if (picked) retype(picked.name);
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
        {/* Always mounted so swapping one message for another is an update to
            a live region a screen reader is already watching, rather than a
            region appearing with its text already in it — which is the case
            readers tend not to announce. */}
        <div role="status" aria-live="polite">
          {searching && <p className="text-muted px-3 py-2 text-xs">Searching&hellip;</p>}
          {searchFailed && (
            <p className="text-danger px-3 py-2 text-sm">
              Search failed &mdash;{" "}
              <button
                type="button"
                // Taking focus would blur the input, which closes the popover
                // — and the retry along with it, before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={retry}
                className="underline"
              >
                try again
              </button>
              .
            </p>
          )}
        </div>
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
