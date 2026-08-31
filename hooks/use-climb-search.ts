"use client";

import { useEffect, useRef, useState } from "react";
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

/** Where the current query stands. Nothing may be acted on unless this says
 * "answered" — `pages` can still hold the previous query's rows. */
export type ClimbSearchStatus = "idle" | "searching" | "failed" | "answered";

type Settled = ClimbSearchPages & {
  filter: ClimbSearchFilter;
  /** The query's canonical identity, so "is this still what's being asked?"
   * is a string compare rather than an array-aware deep one. */
  key: string;
  matchCount: number;
};

export type ClimbSearchState = {
  /** Accumulated pages, kept across a query change so refining narrows the
   * list rather than blanking it — so these may answer the PREVIOUS query.
   * Gate anything actionable on `status === "answered"`. */
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

/** JSON, not a joined separator: the parts are free text, so "Rock" +
 * "Wall Face" and "Rock Wall" + "Face" collide under any separator they can
 * contain — and a collision makes a stale answer look current. */
function queryKeyOf(disciplineKey: string, areaName: string, name: string): string {
  return JSON.stringify([disciplineKey, areaName, name]);
}

/** Debounced, paged climb search by name, area, and/or discipline, sorted
 * most-ascended first — which doubles as relevance, surfacing the routes
 * people actually climb over their obscure namesakes.
 *
 * Callers own the query; this owns the lookup: debounce, cancellation,
 * out-of-order discard, and a "load more" scoped to the query it was fired
 * for. */
export function useClimbSearch(query: ClimbSearchQuery): ClimbSearchState {
  const name = query.name.trim();
  const areaName = query.areaName.trim();
  const disciplineKey = disciplineKeyOf(query.disciplines);
  const active = name !== "" || areaName !== "" || disciplineKey !== "";
  const key = queryKeyOf(disciplineKey, areaName, name);

  const [settled, setSettled] = useState<Settled | null>(null);
  /** The key whose own lookup failed, so the message can't outlive the query
   * it was about. */
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  /** The in-flight "load more", so a query change can abort it and its own
   * completion can tell whether it's still the current one. */
  const loadMoreRef = useRef<{ controller: AbortController; key: string } | null>(null);

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
      // Returning to a query that failed earlier is a fresh attempt, not a
      // standing failure.
      setFailedKey((prev) => (prev === key ? null : prev));
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

  // The ref is deliberately left in place, so the aborted request's own
  // `finally` still clears `loadingMore`.
  useEffect(() => {
    return () => loadMoreRef.current?.controller.abort();
  }, [key]);

  async function loadMore() {
    const base = settled;
    // A stale base would append rows answering a different question.
    if (!base || base.key !== key || !base.hasNextPage || loadingMore) return;

    const request = { controller: new AbortController(), key };
    loadMoreRef.current = request;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const next = await fetchClimbSearchPage(
        DEFAULT_CLIMB_SEARCH_SORT,
        base.filter,
        base.loadedPages + 1,
        { signal: request.controller.signal },
      );
      if (loadMoreRef.current !== request) return;
      setSettled((prev) => (prev === base ? { ...prev, ...appendPage(prev, next) } : prev));
    } catch {
      // Superseded: the query this belonged to is gone, so an error under the
      // new one would be unactionable.
      if (request.controller.signal.aborted || loadMoreRef.current !== request) return;
      setLoadMoreFailed(true);
    } finally {
      if (loadMoreRef.current === request) {
        loadMoreRef.current = null;
        setLoadingMore(false);
      }
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
