/** Raw native form controls (<input>, <select>) that sit inside HeroUI
 * TextFields wear HeroUI's own `.input` class — the exact rules its Input
 * renders (field radius, background, shadow, border, hover/focus/invalid/
 * disabled states) — so a native select is indistinguishable from the styled
 * field beside it. A hand-rolled approximation used to give these a hairline
 * border and a smaller radius that HeroUI fields never had. */
export const FIELD_CLASS = "input";
