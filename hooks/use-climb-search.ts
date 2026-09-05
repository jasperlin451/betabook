"use client";

import { useEffect, useRef, useState } from "react";

import type { Discipline } from "@/db/queries";
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

/** No selected disciplines means all; a completely empty query does not run. */
export type ClimbSearchQuery = {
  name: string;
  areaName: string;
  disciplines: Discipline[];
};

/** Only answered results are actionable; pages may still belong to the previous query. */
type ClimbSearchStatus = "idle" | "searching" | "failed" | "answered";

type Settled = ClimbSearchPages & {
  filter: ClimbSearchFilter;
  key: string;
  matchCount: number;
};

export type ClimbSearchState = {
  /** Prior pages remain visible while searching. Gate selection on status === "answered". */
  pages: ClimbSearchPages | null;
  matchCount: number;
  status: ClimbSearchStatus;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
};

/** Canonicalize chip order and avoid array identities in effect dependencies. */
function disciplineKeyOf(disciplines: Discipline[]): string {
  return [...disciplines].sort().join(",");
}

/** Encode free-text parts with JSON to prevent separator collisions in query identity. */
function queryKeyOf(disciplineKey: string, areaName: string, name: string): string {
  return JSON.stringify([disciplineKey, areaName, name]);
}

/** Debounced, paginated search with cancellation and stale-response protection. */
export function useClimbSearch(query: ClimbSearchQuery): ClimbSearchState {
  const name = query.name.trim();
  const areaName = query.areaName.trim();
  const disciplineKey = disciplineKeyOf(query.disciplines);
  const active = name !== "" || areaName !== "" || disciplineKey !== "";
  const key = queryKeyOf(disciplineKey, areaName, name);

  const [settled, setSettled] = useState<Settled | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  const loadMoreRef = useRef<{ controller: AbortController; key: string } | null>(null);

  useEffect(() => {
    if (!active) return;
    // Rebuild from the stable key so inline arrays do not restart the effect.
    const disciplines = disciplineKey ? (disciplineKey.split(",") as Discipline[]) : [];
    const filter: ClimbSearchFilter = {
      ...DEFAULT_CLIMB_SEARCH_FILTER,
      name,
      areaName,
      disciplines,
    };

    const controller = new AbortController();
    // Discard superseded responses even if the transport could not abort.
    let superseded = false;

    const timeout = setTimeout(() => {
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

  // Leave the ref in place so the aborted request's finally can clear loadingMore.
  useEffect(() => {
    return () => loadMoreRef.current?.controller.abort();
  }, [key]);

  async function loadMore() {
    const base = settled;
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
    // Searching includes the debounce window.
    status: !active ? "idle" : answered ? "answered" : failedKey === key ? "failed" : "searching",
    loadingMore,
    loadMoreFailed,
    loadMore,
  };
}
