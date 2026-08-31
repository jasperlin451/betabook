import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  SEARCH_PAGE_SIZE,
  countSearchClimbs,
  getAreaBreadcrumbs,
  getClimbSendStats,
  searchClimbs,
} from "@/db/queries";
import {
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import { parsePage, parseSuggestionLimit, searchParamsToRecord } from "@/lib/search-params";

/** Backs two callers with the same query.
 *
 * Without `limit`: incremental "load more" for home-page climb search — the
 * initial page is server-rendered (app/page.tsx); this backs subsequent
 * pages so result #26 is reachable without shipping unbounded results in the
 * first paint. Takes the same query params as the page itself (see
 * climbSearchFilterToSearchParams) plus `page`.
 *
 * With `limit`: suggestion mode for the route typeaheads. A popover row
 * shows a name, an area, and a grade — all of which `searchClimbs` already
 * returns — so the two extra join passes a result row needs are skipped
 * entirely rather than computed for rows nobody renders.
 *
 * With `count=1`: also returns the exact match total (see the search page's
 * heading). Opt-in because the total doesn't change between pages of a
 * search, so only its first page should pay for the COUNT. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);
  const limit = parseSuggestionLimit(url.searchParams);
  const withCount = url.searchParams.get("count") === "1";

  const sort = parseClimbSearchSort(searchParams);
  const filter = parseClimbSearchFilter(searchParams);
  const page = parsePage(url.searchParams, SEARCH_PAGE_SIZE);

  const db = await getDb();
  const queryParams = toSearchClimbsQueryParams(filter, sort);
  const results = await searchClimbs(db, queryParams, page);

  if (limit !== null) {
    return NextResponse.json({ climbs: results.climbs.slice(0, limit) });
  }

  const [sendStats, areaBreadcrumbs, count] = await Promise.all([
    getClimbSendStats(db, results.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, results.climbs.map((c) => c.areaId)),
    withCount ? countSearchClimbs(db, queryParams) : Promise.resolve(undefined),
  ]);

  return NextResponse.json({ ...results, sendStats, areaBreadcrumbs, count });
}
