"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Debounces navigation to `href` — used by every filter panel/search form
 * that auto-navigates on each field change instead of requiring a submit.
 *
 * `currentHref` is the canonical serialization of the URL the caller's
 * props were rendered from (the same href builder applied to the incoming
 * URL-derived values). A navigation only fires while `href` differs from
 * it, so mounting on a bare URL (`/areas/1`) or editing a field back to the
 * URL's own value fires nothing — no rewriting a shareable URL with default
 * params, no wasted server round trip. Comparing against `currentHref`
 * instead of the literal location makes the comparison canonical for free:
 * `/areas/1` and its fully-parameterized equivalent compare equal because
 * both parse to the same filter (see the serialization fixed-point tests
 * next to each filter's lib module).
 *
 * Returns:
 * - `isPending`: true while a fired navigation's server round trip is in
 *   flight (the replace runs inside a transition) — pending UI for the
 *   results the navigation is about to replace.
 * - `urlChangedExternally`: true for the render in which `currentHref`
 *   changed to something this hook didn't itself navigate to (back/forward,
 *   a sort control's own replace) — the caller's cue to adopt the incoming
 *   URL-derived values into its local state. A change that is just our own
 *   navigation round-tripping through the server reports false, so acting
 *   on this never disturbs in-progress typing. */
export function useDebouncedReplace(
  href: string,
  currentHref: string,
  delayMs = 400,
): { isPending: boolean; urlChangedExternally: boolean } {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Every href this hook has navigated to whose URL change hasn't come back
  // yet, oldest first. A queue rather than a single slot: on a slow round
  // trip a second debounce can fire before the first navigation's URL
  // arrives, and remembering only the latest would make the first one's
  // arrival read as external — re-seeding the caller's inputs from a URL the
  // user has already typed past. Entries are consumed once (the match and
  // everything it superseded are dropped), so a later forward to a URL we
  // once emitted still reads as external. Held in state, not a ref — it's
  // read during render and the render-phase consumption below has to stay
  // deterministic under Strict Mode's double-invoked renders.
  const [navigatedHrefs, setNavigatedHrefs] = useState<string[]>([]);
  const [prevCurrentHref, setPrevCurrentHref] = useState(currentHref);
  const currentHrefChanged = currentHref !== prevCurrentHref;
  const navigatedIndex = currentHrefChanged ? navigatedHrefs.indexOf(currentHref) : -1;
  if (currentHrefChanged) {
    setPrevCurrentHref(currentHref);
    // A match consumes it and every older pending navigation it superseded;
    // a non-match (back/forward) means the queue no longer describes where
    // the URL is, so it's dropped wholesale.
    setNavigatedHrefs(navigatedIndex === -1 ? [] : navigatedHrefs.slice(navigatedIndex + 1));
  }
  const urlChangedExternally = currentHrefChanged && navigatedIndex === -1;

  useEffect(() => {
    if (href === currentHref) return;
    const timeout = setTimeout(() => {
      setNavigatedHrefs((pending) => [...pending, href]);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [href, currentHref, delayMs, router, startTransition]);

  return { isPending, urlChangedExternally };
}
