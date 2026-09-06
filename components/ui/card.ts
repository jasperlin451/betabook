/** Standard panel surface and spacing. Feature panels with different fills
 * or borders use rounded-panel directly; its radius lives in app/globals.css. */
const CARD_CLASS = "rounded-panel bg-surface-secondary";

/** Card paddings: `sm` for dense stat cards and expanded filter panels,
 * `md` for forms and settings, `fluid` for wide analytics cards that need
 * room on desktop but not on a phone. */
export const CARD_PADDING = {
  sm: "p-4",
  md: "p-6",
  fluid: "p-4 sm:p-6",
} as const;

export function cardClass(padding: keyof typeof CARD_PADDING = "md"): string {
  return `${CARD_CLASS} ${CARD_PADDING[padding]}`;
}

/** Narrow centered card for auth/account-style single-purpose pages. */
export const FORM_CARD_CLASS = `mx-auto flex max-w-sm flex-col gap-4 ${cardClass("md")}`;

/** Full-width surface card for entity forms. */
export const SURFACE_CARD_CLASS = `flex flex-col gap-4 ${cardClass("md")}`;
