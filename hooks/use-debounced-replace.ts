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

  // The href this hook last navigated to, consumed (reset to null) when the
  // resulting URL change arrives back as `currentHref`. Consuming exactly
  // once matters: after back/forward is adopted, a later forward to a URL we
  // once emitted must still read as external. Held in state, not a ref —
  // it's read during render and the render-phase consumption below has to
  // stay deterministic under Strict Mode's double-invoked renders.
  const [navigatedHref, setNavigatedHref] = useState<string | null>(null);
  const [prevCurrentHref, setPrevCurrentHref] = useState(currentHref);
  const currentHrefChanged = currentHref !== prevCurrentHref;
  if (currentHrefChanged) {
    setPrevCurrentHref(currentHref);
    setNavigatedHref(null);
  }
  const urlChangedExternally = currentHrefChanged && currentHref !== navigatedHref;

  useEffect(() => {
    if (href === currentHref) return;
    const timeout = setTimeout(() => {
      setNavigatedHref(href);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [href, currentHref, delayMs, router, startTransition]);

  return { isPending, urlChangedExternally };
}
