"use client";

import { clsx } from "clsx";
import NextLink from "next/link";
import { useReducer } from "react";
import type { ComponentProps } from "react";

type AppLinkProps = ComponentProps<typeof NextLink>;

/** `next/link` wearing HeroUI Link's clothes — the drop-in for internal
 * links that HeroUI's `Link` can't prefetch (it routes through react-aria's
 * RouterProvider, which only navigates).
 *
 * Styling: HeroUI's `.link` class styles hover/press via native
 * pseudo-classes, so a plain anchor gets those for free; only the
 * focus-visible ring comes exclusively from react-aria's data attributes,
 * so it's re-added here (same `status-focused` utility the CSS applies).
 *
 * Prefetching: in the viewport, the default ("auto") applies — full prefetch
 * for static routes, and for dynamic routes only down to a `loading.js`
 * boundary. Every entity page here is dynamic (D1 + session), so on
 * hover/focus intent the link upgrades to `prefetch={true}`, which fetches
 * the full route including data — warming exactly the pages the user is
 * about to visit instead of every row of a list. (This is the documented
 * hover-prefetch pattern from the Next prefetching guide, with `true` in
 * place of `null` because these routes are dynamic.) An explicit `prefetch`
 * prop opts out of the intent upgrade entirely. */
export function AppLink({
  className,
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...props
}: AppLinkProps) {
  const [intent, signalIntent] = useReducer(() => true, false);

  return (
    <NextLink
      {...props}
      className={clsx("link focus-visible:status-focused", className)}
      prefetch={prefetch !== undefined ? prefetch : intent ? true : null}
      onMouseEnter={(event) => {
        signalIntent();
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        signalIntent();
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        signalIntent();
        onFocus?.(event);
      }}
    />
  );
}
