"use client";

import { useEffect, useRef, useState } from "react";

/** Every typeahead in the app waits the same beat before asking the server.
 * Shorter than `useDebouncedReplace`'s navigation debounce (400ms): a
 * suggestion list is cheap and disposable, so it can afford to be eager,
 * where a navigation rewrites the URL and re-renders a page. */
export const TYPEAHEAD_DEBOUNCE_MS = 300;

/** How many suggestions a popover offers. Also sent to the server as
 * `limit`, so the query does less work rather than the client throwing rows
 * away (see app/api/search). */
export const TYPEAHEAD_LIMIT = 5;

/** Resolves the suggestions for `query`. The signal aborts when the query
 * moves on — pass it to `fetch`; a transport that can't be cancelled (a
 * server action) may ignore it and still be safe, since the result of a
 * superseded lookup is discarded either way. */
export type TypeaheadFetcher<T> = (query: string, signal: AbortSignal) => Promise<T[]>;

export type TypeaheadState<T> = {
  items: T[];
  /** True from the keystroke until that query's lookup settles — drives the
   * popover's "Searching…" state. Distinct from "no matches": an empty list
   * while pending means "not yet", not "nothing". */
  isPending: boolean;
};

/** The data half of every typeahead: debounce, cancel, and discard
 * out-of-order responses, and never surface a failure.
 *
 * The out-of-order guard is the load-bearing part. Aborting the in-flight
 * request handles the common case, but a response that has already left the
 * server can still land after a newer one — and an uncancellable transport
 * can't even be aborted — so each run also holds a `superseded` flag its own
 * cleanup sets. Nothing from a stale run reaches state.
 *
 * Failures resolve to an empty list rather than an error: suggestions are a
 * convenience layered on a field that works as plain text without them, and
 * an error popover over a search box the user is mid-sentence in costs more
 * than it explains. Callers that need to distinguish "no matches" from "the
 * lookup failed" don't exist yet; when one does, this returns the state to
 * widen, not the call sites. */
export function useTypeahead<T>(
  query: string,
  fetcher: TypeaheadFetcher<T>,
  {
    debounceMs = TYPEAHEAD_DEBOUNCE_MS,
    enabled = true,
    scope = "",
  }: { debounceMs?: number; enabled?: boolean; scope?: string } = {},
): TypeaheadState<T> {
  // The query AND scope these items answer, stored alongside them rather than
  // as a separate `isPending` flag: "still loading" is exactly "what settled
  // isn't what's being asked for", so deriving it can't drift out of sync
  // with the items the way independent pieces of state would.
  //
  // `scope` is what the fetcher is parameterized by (an area id, say). The
  // fetcher itself can't be the trigger — call sites build it inline, so its
  // identity changes every render — but results fetched under one scope must
  // not survive into another, which the query alone can't express.
  const [settled, setSettled] = useState<{ query: string; scope: string; items: T[] }>({
    query: "",
    scope: "",
    items: [],
  });

  // Call sites pass an inline arrow (it closes over an areaId, a limit, …),
  // so a new identity arrives every render. Depending on it directly would
  // restart the debounce on every render and never settle; the ref keeps the
  // latest one reachable while `query` and `scope` stay the triggers.
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
          // Settling empty, not leaving it pending: a failed lookup is a
          // finished one, and the popover should say "nothing" rather than
          // spin forever.
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

  // Results from a different scope are not "the previous matches", they're
  // answers to a different question — so unlike a query change, a scope
  // change drops them rather than showing them while the new ones load.
  const scopeMatches = settled.scope === scope;

  return {
    // Clearing the field empties the popover immediately rather than leaving
    // the last query's matches sitting under an empty input. A *changed*
    // query keeps the previous matches on screen until the new ones land,
    // which reads as a list refining rather than blinking out per keystroke.
    //
    // A disabled lookup reports nothing: its fetch is stopped, so whatever it
    // settled on last is a leftover its caller must not treat as current.
    items: enabled && trimmed && scopeMatches ? settled.items : [],
    isPending: enabled && trimmed !== "" && (settled.query !== trimmed || !scopeMatches),
  };
}
