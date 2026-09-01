/** Page sizes for the two lists whose API routes page by number rather than
 * offset (the home feed and area search). Kept here, not in db/queries, so
 * the client components that turn "rows loaded so far" back into a page
 * number can import them without pulling the query layer into the bundle. */
export const RECENT_SENDS_PAGE_SIZE = 15;
export const AREA_SEARCH_PAGE_SIZE = 25;
