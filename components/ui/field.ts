/** Raw native form controls (<input>, <select>) that sit inside HeroUI
 * TextFields wear HeroUI's own `.input` class — the exact rules its Input
 * renders (field radius, background, shadow, border, hover/focus/invalid/
 * disabled states) — so a native select is indistinguishable from the styled
 * field beside it. A hand-rolled approximation used to give these a hairline
 * border and a smaller radius that HeroUI fields never had. */
export const FIELD_CLASS = "input";

/** Square actions beside a default field share its line box + vertical
 * padding, including the semantic border. HeroUI's standalone button sizes
 * do not include the field border and switch size at a different breakpoint. */
export const FIELD_ACTION_CLASS =
  "size-[calc(2.5rem+2*var(--border-width-field))] sm:size-[calc(2.25rem+2*var(--border-width-field))]";
