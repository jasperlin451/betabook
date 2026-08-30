"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ComboBox, Input, ListBox } from "@heroui/react";
import { formatGrade } from "@/lib/grades";
import { Grade } from "@/components/ui/grade";
import type { ClimbWithAreaName } from "@/db/queries";

const SUGGESTION_LIMIT = 5;
const SHOW_ALL_KEY = "__show-all";

type Suggestion =
  | { key: string; kind: "climb"; climb: ClimbWithAreaName }
  | { key: string; kind: "show-all" };

/** The feed's search entry point, with typeahead: the top five matching
 * routes (most-climbed first) jump straight to their pages, and the last
 * row — or plain Enter / the Search button — opens the full results view. */
export function HomeSearchBar() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [climbs, setClimbs] = useState<ClimbWithAreaName[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const query = name.trim();
    if (!query) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search/climbs?name=${encodeURIComponent(query)}`);
          if (!res.ok) return;
          const data: { climbs: ClimbWithAreaName[] } = await res.json();
          setClimbs(data.climbs.slice(0, SUGGESTION_LIMIT));
        } catch {
          // Typeahead is a convenience — a failed fetch leaves plain search.
        }
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [name]);

  function resultsHref(): string {
    const params = new URLSearchParams({ mode: "climb" });
    const query = name.trim();
    if (query) params.set("name", query);
    return `/?${params.toString()}`;
  }

  const suggestions: Suggestion[] = name.trim()
    ? [
        ...climbs.map((climb): Suggestion => ({ key: String(climb.id), kind: "climb", climb })),
        ...(climbs.length > 0 ? [{ key: SHOW_ALL_KEY, kind: "show-all" } as Suggestion] : []),
      ]
    : [];

  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(resultsHref());
      }}
    >
      <ComboBox<Suggestion>
        aria-label="Search routes"
        allowsCustomValue
        allowsEmptyCollection
        menuTrigger="input"
        inputValue={name}
        onInputChange={setName}
        items={suggestions}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key == null) return;
          if (key === SHOW_ALL_KEY) {
            router.push(resultsHref());
            return;
          }
          const picked = climbs.find((climb) => String(climb.id) === key);
          if (picked) router.push(`/climbs/${picked.id}`);
        }}
        className="min-w-0 flex-1"
      >
        {/* ComboBox.InputGroup's sibling wiring requires exactly its Input
          * + Trigger children — anything else (wrappers, icons, Prefix
          * slots, or a MISSING trigger) corrupts it. So: magnifier as a
          * themed background image on the input (search-combo-input in
          * globals.css), and the trigger kept in the tree but hidden —
          * typing is what opens the suggestions, and an arrow on an empty
          * field promises a list that isn't there. */}
        <ComboBox.InputGroup>
          <Input placeholder="Search routes…" className="search-combo-input" />
          <ComboBox.Trigger className="hidden" />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            {(item: Suggestion) =>
              item.kind === "climb" ? (
                <ListBox.Item id={item.key} textValue={item.climb.name}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0">
                      <p className="truncate">{item.climb.name}</p>
                      <p className="truncate text-muted text-xs">{item.climb.areaName}</p>
                    </span>
                    <Grade>{formatGrade(item.climb.type, item.climb.grade)}</Grade>
                  </span>
                </ListBox.Item>
              ) : (
                <ListBox.Item id={item.key} textValue="Show all results">
                  <p className="text-sm">Show all results…</p>
                </ListBox.Item>
              )
            }
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <Button type="submit">Search</Button>
    </form>
  );
}
