/** Raw native form controls (<input>, <select>) that sit inside HeroUI
 * TextFields wear HeroUI's own `.input` class — the exact rules its Input
 * renders (field radius, background, shadow, border, hover/focus/invalid/
 * disabled states) — so a native select is indistinguishable from the styled
 * field beside it. A hand-rolled approximation used to give these a hairline
 * border and a smaller radius that HeroUI fields never had. */
export const FIELD_CLASS = "input";

/** One-line fields share responsive line height, padding, and theme border width. */
export const FIELD_HEIGHT_CLASS =
  "h-[calc(2.5rem+2*var(--border-width-field))] sm:h-[calc(2.25rem+2*var(--border-width-field))]";

/** Square actions use the same height as the adjacent field. */
export const FIELD_ACTION_CLASS = `${FIELD_HEIGHT_CLASS} w-[calc(2.5rem+2*var(--border-width-field))] sm:w-[calc(2.25rem+2*var(--border-width-field))]`;
