"use client";

import { useEffect, useState } from "react";
import { TYPEAHEAD_DEBOUNCE_MS } from "@/hooks/use-typeahead";
import {
  DEFAULT_CLIMB_SEARCH_FILTER,
  DEFAULT_CLIMB_SEARCH_SORT,
  type ClimbSearchFilter,
} from "@/lib/climb-search-filter";
import {
  appendPage,
  fetchClimbSearchPage,
  firstPage,
  type ClimbSearchPages,
} from "@/lib/climb-search-pages";
import type { Discipline } from "@/db/queries";

/** What a climb search is asked by. Any of the three narrows it; none of them
 * means there's nothing to look up. Empty `disciplines` means all — the
 * convention every filter in the app follows (see toDisciplineGradeFilter). */
export type ClimbSearchQuery = {
  name: string;
  areaName: string;
  disciplines: Discipline[];
};

/** Where the current query stands. Distinguishing "searching" from "answered
 * with nothing" is the whole point — an empty list means different things. */
export type ClimbSearchStatus = "idle" | "searching" | "failed" | "answered";

type Settled = ClimbSearchPages & {
  filter: ClimbSearchFilter;
  /** The query's canonical identity, so "is this still what's being asked?"
   * is a string compare rather than an array-aware deep one. */
  key: string;
  matchCount: number;
};

export type ClimbSearchState = {
  /** Accumulated pages, or null with nothing asked. Kept across a query
   * change so refining reads as a list narrowing rather than blinking. */
  pages: ClimbSearchPages | null;
  /** Total matches for the settled query, including past what's loaded. */
  matchCount: number;
  status: ClimbSearchStatus;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
};

/** Order-independent, so toggling two chips back to the same pair doesn't
 * read as a different search. A string because it's also an effect
 * dependency, where an array literal would differ on every render. */
function disciplineKeyOf(disciplines: Discipline[]): string {
  return [...disciplines].sort().join(",");
}

/** Debounced, paged climb search by name, area, and/or discipline, sorted
 * most-ascended first — which doubles as relevance, surfacing the routes
 * people actually climb over their obscure namesakes.
 *
 * Callers own the query; this owns the lookup: debounce, cancellation,
 * out-of-order discard, and a "load more" that can't append to a superseded
 * search. */
export function useClimbSearch(query: ClimbSearchQuery): ClimbSearchState {
  const name = query.name.trim();
  const areaName = query.areaName.trim();
  const disciplineKey = disciplineKeyOf(query.disciplines);
  const active = name !== "" || areaName !== "" || disciplineKey !== "";
  // Whitespace-joined: the parts can't contain a space that would let two
  // different queries collide (names are trimmed, the key is comma-joined).
  const key = [disciplineKey, areaName, name].join(" ");

  const [settled, setSettled] = useState<Settled | null>(null);
  /** The key whose own lookup failed, so the message can't outlive the query
   * it was about. */
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  useEffect(() => {
    // Nothing to look up, and nothing to clear either: an emptied query hides
    // what settled by deriving (see `pages` below) rather than by writing
    // state from an effect, same as useTypeahead.
    if (!active) return;
    // Rebuilt from the key rather than closed over `query.disciplines`, whose
    // array identity changes every render and so can't be a dependency.
    const disciplines = disciplineKey ? (disciplineKey.split(",") as Discipline[]) : [];
    const filter: ClimbSearchFilter = {
      ...DEFAULT_CLIMB_SEARCH_FILTER,
      name,
      areaName,
      disciplines,
    };

    const controller = new AbortController();
    // A response already on the wire can still land after a newer one, so the
    // abort isn't enough on its own — same guard as useTypeahead.
    let superseded = false;

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const page = await fetchClimbSearchPage(DEFAULT_CLIMB_SEARCH_SORT, filter, 1, {
            count: true,
            signal: controller.signal,
          });
          if (superseded) return;
          setSettled({
            ...firstPage(page),
            filter,
            key,
            matchCount: page.count ?? page.climbs.length,
          });
          setFailedKey(null);
          setLoadMoreFailed(false);
        } catch {
          if (superseded) return;
          setFailedKey(key);
        }
      })();
    }, TYPEAHEAD_DEBOUNCE_MS);

    return () => {
      superseded = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [active, key, name, areaName, disciplineKey]);

  async function loadMore() {
    // Captured by identity: a query that moves on while this is in flight
    // replaces `settled` wholesale, and the guard below drops the page rather
    // than appending it to rows answering a different question.
    const base = settled;
    if (!base) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const next = await fetchClimbSearchPage(
        DEFAULT_CLIMB_SEARCH_SORT,
        base.filter,
        base.loadedPages + 1,
      );
      setSettled((prev) => (prev === base ? { ...prev, ...appendPage(prev, next) } : prev));
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const answered = settled?.key === key;

  return {
    pages: active ? settled : null,
    matchCount: settled?.matchCount ?? 0,
    // "searching" spans the debounce window plus the request: a query with no
    // answer of its own yet.
    status: !active ? "idle" : answered ? "answered" : failedKey === key ? "failed" : "searching",
    loadingMore,
    loadMoreFailed,
    loadMore,
  };
}
