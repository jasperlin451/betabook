/** The app shell's content width (app/layout.tsx's header/main/footer) and
 * every full-width drawer (climb/area/send forms, delete confirmation) share
 * this one constant so widening the app always widens its drawers too,
 * instead of drifting out of sync across five separate hardcoded classes. */
export const PAGE_MAX_WIDTH_CLASS = "max-w-7xl";
