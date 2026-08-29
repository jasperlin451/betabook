/** The app shell's content width (app/layout.tsx's header/main/footer) and
 * every full-width form drawer (climb/area/send forms) share this one
 * constant so widening the app always widens its drawers too, instead of
 * drifting out of sync across five separate hardcoded classes. */
export const PAGE_MAX_WIDTH_CLASS = "max-w-7xl";

/** One-sentence confirmation drawers (delete climb/area/send) — a dialog's
 * width, not the page's: a max-w-7xl sheet holding one line and two buttons
 * reads as a page takeover instead of a confirmation. */
export const CONFIRM_DRAWER_WIDTH_CLASS = "max-w-md";
