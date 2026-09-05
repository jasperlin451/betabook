"use client";

import { useEffect, useRef, useState } from "react";

export const TYPEAHEAD_DEBOUNCE_MS = 300;

export const TYPEAHEAD_LIMIT = 5;

/** Pass the signal to cancellable transports. Superseded results are also discarded. */
export type TypeaheadFetcher<T> = (query: string, signal: AbortSignal) => Promise<T[]>;

export type TypeaheadState<T> = {
  items: T[];
  /** True until the current query and scope settle, including during the debounce. */
  isPending: boolean;
};

/** Suggestions fail to an empty list. Cleanup also marks responses superseded
 * because aborting alone cannot prevent stale results from updating state. */
export function useTypeahead<T>(
  query: string,
  fetcher: TypeaheadFetcher<T>,
  {
    debounceMs = TYPEAHEAD_DEBOUNCE_MS,
    enabled = true,
    scope = "",
  }: { debounceMs?: number; enabled?: boolean; scope?: string } = {},
): TypeaheadState<T> {
  // Scope identifies fetcher inputs such as areaId; a query alone cannot
  // distinguish results loaded for different areas.
  const [settled, setSettled] = useState<{ query: string; scope: string; items: T[] }>({
    query: "",
    scope: "",
    items: [],
  });

  // Inline fetchers change identity on every render. Keep the latest in a ref
  // so only query and scope changes restart the debounce.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const trimmed = query.trim();

  useEffect(() => {
    if (!enabled || !trimmed) return;

    const controller = new AbortController();
    let superseded = false;

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const items = await fetcherRef.current(trimmed, controller.signal);
          if (!superseded) setSettled({ query: trimmed, scope, items });
        } catch {
          if (!superseded) setSettled({ query: trimmed, scope, items: [] });
        }
      })();
    }, debounceMs);

    return () => {
      superseded = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [trimmed, scope, debounceMs, enabled]);

  const scopeMatches = settled.scope === scope;

  return {
    // Keep prior results while typing within a scope; clear on empty input,
    // disabled lookup, or a scope change.
    items: enabled && trimmed && scopeMatches ? settled.items : [],
    isPending: enabled && trimmed !== "" && (settled.query !== trimmed || !scopeMatches),
  };
}
