"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Kbd, Modal, useOverlayState } from "@heroui/react";
import { Search } from "lucide-react";
import clsx from "clsx";
import { AreaSuggestionRow } from "@/components/area-search-field";
import { RouteSuggestionRow } from "@/components/route-search-field";
import { useSearchScope } from "@/components/search-scope";
import { isApplePlatform, useModifierLabels } from "@/hooks/use-platform";
import { useTypeahead } from "@/hooks/use-typeahead";
import {
  fetchAreaSuggestions,
  fetchRouteSuggestions,
  type AreaSuggestion,
  type RouteSuggestion,
} from "@/lib/search-suggestions";

type PaletteEntry = {
  key: string;
  href: string;
  /** Plain-text identity, for the a11y announcement of the active row. */
  text: string;
  content: React.ReactNode;
};

type PaletteSection = {
  heading: string;
  entries: PaletteEntry[];
  /** Set on the trailing actions group, which has no heading to separate it
   * from the results above — without a rule it reads as more Areas. */
  divider?: boolean;
};

/** One "search all X" escape row. Every query has these, so the palette
 * never dead-ends on a suggestion list that missed what you meant. */
function SearchAllRow({
  entity,
  query,
  shortcut,
}: {
  entity: string;
  query: string;
  /** The platform's modifier+Enter label, on the row that chord triggers.
   * Null before mount, when the platform isn't known yet. */
  shortcut?: string | null;
}) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="truncate">
        Search all {entity} for <span className="font-medium">{query}</span>
      </span>
      {shortcut && <Kbd className="shrink-0">{shortcut}</Kbd>}
    </span>
  );
}

function routeEntry(route: RouteSuggestion): PaletteEntry {
  return {
    key: `route-${route.id}`,
    href: `/climbs/${route.id}`,
    text: route.name,
    content: <RouteSuggestionRow route={route} />,
  };
}

function areaEntry(area: AreaSuggestion): PaletteEntry {
  return {
    key: `area-${area.id}`,
    href: `/areas/${area.id}`,
    text: area.name,
    content: <AreaSuggestionRow area={area} />,
  };
}

/** Site-wide search on ⌘K (Ctrl+K off macOS) — a navigator, so every row
 * goes somewhere and the last one always escapes to full search rather than
 * dead-ending on "no results".
 *
 * Context-aware via `useSearchScope`: on an area page the first section is
 * that area's own routes, which is almost always what someone searching from
 * a crag page means. Those ids are then excluded from the global section, so
 * a scoped match never appears twice.
 *
 * Keyboard is the `aria-activedescendant` pattern rather than roving DOM
 * focus: focus never leaves the input, so arrowing through results and
 * continuing to type are the same mode — which is the whole point of a
 * palette. */
export function CommandPalette() {
  const router = useRouter();
  const state = useOverlayState();
  const scope = useSearchScope();

  return (
    <>
      <PaletteTrigger onOpen={state.open} />
      <Modal.Root state={state}>
        <Modal.Backdrop>
          {/* Top-anchored: a palette that opens under the pointer reads as a
            * dropdown from the trigger, not a takeover of the page. */}
          <Modal.Container placement="top" size="lg" className="pt-[10vh]">
            <Modal.Dialog aria-label="Search Betabook">
              {/* No `key` on open state: the modal keeps its children
                * mounted through the exit animation, so remounting on close
                * would blank the query and results mid-fade and re-fire
                * autoFocus inside the closing dialog. The overlay already
                * unmounts this subtree between opens, which is what gives
                * each session its fresh empty state. */}
              <PaletteBody
                scopeAreaId={scope?.areaId}
                scopeAreaName={scope?.areaName}
                onNavigate={(href) => {
                  state.close();
                  router.push(href);
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </>
  );
}

/** The header affordance, and the global hotkey it advertises. Split out so
 * the listener isn't re-registered as the palette's own query state changes. */
function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const keys = useModifierLabels();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Command on Apple, Control on Windows/Linux (which have no Command
      // key at all) — deliberately not "either modifier": Ctrl+K is
      // kill-line in a macOS text field, and claiming it there would break
      // editing in every form on the site.
      const chord = isApplePlatform()
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
      if (!chord || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      onOpen();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search"
      aria-keyshortcuts={keys?.ariaPalette}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-muted transition-colors hover:text-foreground"
    >
      <Search className="size-4" />
      <span className="hidden text-sm sm:inline">Search</span>
      {keys && <Kbd className="hidden sm:inline-flex">{keys.palette}</Kbd>}
    </button>
  );
}

/** Mounted fresh by the overlay on each open, so a session starts empty
 * rather than showing the last search's results before the first keystroke. */
function PaletteBody({
  scopeAreaId,
  scopeAreaName,
  onNavigate,
}: {
  scopeAreaId?: number;
  scopeAreaName?: string;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const keys = useModifierLabels();
  const listId = useId();
  const optionIdPrefix = useId();
  const activeRef = useRef<HTMLLIElement | null>(null);

  const scopedFetcher = useCallback(
    (q: string, signal: AbortSignal) => fetchRouteSuggestions(q, signal, { areaId: scopeAreaId }),
    [scopeAreaId],
  );
  const routeFetcher = useCallback(
    (q: string, signal: AbortSignal) => fetchRouteSuggestions(q, signal),
    [],
  );
  const areaFetcher = useCallback((q: string, signal: AbortSignal) => fetchAreaSuggestions(q, signal), []);

  const scoped = useTypeahead(query, scopedFetcher, {
    enabled: scopeAreaId != null,
    scope: String(scopeAreaId ?? ""),
  });
  const routes = useTypeahead(query, routeFetcher);
  const areas = useTypeahead(query, areaFetcher);

  const trimmed = query.trim();
  const searchAllHref = `/?mode=climb&name=${encodeURIComponent(trimmed)}`;
  const isPending = scoped.isPending || routes.isPending || areas.isPending;

  const sections = useMemo((): PaletteSection[] => {
    if (!trimmed) return [];

    const result: PaletteSection[] = [];

    // Derived from the scoped rows only when they are actually rendered. A
    // set built from rows nobody can see would still subtract those routes
    // from "Routes", leaving them reachable from neither section.
    const showScoped = Boolean(scopeAreaName) && scoped.items.length > 0;
    const scopedIds = new Set(showScoped ? scoped.items.map((route) => route.id) : []);

    if (showScoped) {
      result.push({ heading: `In ${scopeAreaName}`, entries: scoped.items.map(routeEntry) });
    }
    // Scoped matches already appeared above; repeating them under "Routes"
    // would make the same route two different answers to one query.
    const globalRoutes = routes.items.filter((route) => !scopedIds.has(route.id));
    if (globalRoutes.length > 0) {
      result.push({ heading: "Routes", entries: globalRoutes.map(routeEntry) });
    }
    if (areas.items.length > 0) {
      result.push({ heading: "Areas", entries: areas.items.map(areaEntry) });
    }

    // Both modes get an escape, since the palette searches both: offering
    // only the route one would strand anyone whose area isn't in the top few.
    result.push({
      heading: "",
      divider: true,
      entries: [
        {
          key: "search-all-routes",
          href: searchAllHref,
          text: `Search all routes for ${trimmed}`,
          content: <SearchAllRow entity="routes" query={trimmed} shortcut={keys?.modEnter} />,
        },
        {
          key: "search-all-areas",
          href: `/?mode=area&name=${encodeURIComponent(trimmed)}`,
          text: `Search all areas for ${trimmed}`,
          content: <SearchAllRow entity="areas" query={trimmed} />,
        },
      ],
    });

    return result;
  }, [trimmed, scoped.items, routes.items, areas.items, scopeAreaName, searchAllHref, keys]);

  const entries = useMemo(() => sections.flatMap((section) => section.entries), [sections]);

  // The highlight is held as the row's own key, not its position. Three
  // independent lookups settle at different times, so rows appear, reorder
  // and shift underneath a highlight that has not moved — an index would
  // then name a different route than the one the user arrowed onto, and
  // Enter would open the wrong thing.
  //
  // Only a new query clears it. Render-time "adjust state when inputs
  // change" (per the React docs, and the shape use-filter-form-navigation
  // already uses): an effect would let one frame paint the stale highlight.
  const [prevTrimmed, setPrevTrimmed] = useState(trimmed);
  if (prevTrimmed !== trimmed) {
    setPrevTrimmed(trimmed);
    setActiveKey(null);
  }

  // Falls back to the first row when the highlighted one is gone — nothing
  // is selected before the first arrow press either, and the top row is what
  // Enter should take in both cases.
  const foundIndex = activeKey == null ? -1 : entries.findIndex((e) => e.key === activeKey);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (trimmed) onNavigate(searchAllHref);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (entries.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveKey(entries[(activeIndex + step + entries.length) % entries.length].key);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry) onNavigate(entry.href);
    }
  }

  let optionIndex = -1;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-separator px-4 py-3">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-expanded={entries.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            entries[activeIndex] ? `${optionIdPrefix}-${entries[activeIndex].key}` : undefined
          }
          aria-label="Search routes and areas"
          autoComplete="off"
          placeholder="Search routes and areas…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        />
        <Kbd className="hidden shrink-0 sm:inline-flex">esc</Kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto p-2">
        {sections.map((section) => (
          <li
            key={section.heading || "actions"}
            role="presentation"
            className={clsx(section.divider && "mt-2 border-t border-separator pt-2")}
          >
            {section.heading && (
              <p className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
                {section.heading}
              </p>
            )}
            <ul role="presentation">
              {section.entries.map((entry) => {
                optionIndex += 1;
                const index = optionIndex;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={entry.key}
                    // Keyed by row, not position, so aria-activedescendant
                    // always resolves to the row that is actually
                    // highlighted even as late results reorder the list.
                    id={`${optionIdPrefix}-${entry.key}`}
                    role="option"
                    aria-selected={isActive}
                    ref={isActive ? activeRef : undefined}
                    onMouseMove={() => setActiveKey(entry.key)}
                    onClick={() => onNavigate(entry.href)}
                    className={clsx(
                      "cursor-pointer rounded-lg px-2 py-2 text-sm",
                      isActive && "bg-surface-secondary",
                    )}
                  >
                    {entry.content}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}

        {entries.length === 0 && (
          <li role="presentation" className="px-2 py-6 text-center text-sm text-muted">
            {!trimmed
              ? "Search routes and areas…"
              : isPending
                ? "Searching…"
                : "Nothing found."}
          </li>
        )}
      </ul>

      <div className="hidden items-center gap-4 border-t border-separator px-4 py-2 text-xs text-muted sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↑↓</Kbd> move
        </span>
        {keys && (
          <span className="flex items-center gap-1.5">
            <Kbd>{keys.modEnter}</Kbd> search all
          </span>
        )}
      </div>
    </div>
  );
}
