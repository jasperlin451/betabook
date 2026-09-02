import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import {
  SEARCH_PAGE_SIZE,
  countSearchClimbs,
  getAreaBreadcrumbs,
  getClimbSendStats,
  getUserSentClimbIds,
  searchClimbs,
} from "@/db/queries";
import {
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import {
  offsetReachesPaginationLimit,
  pageReachesPaginationLimit,
  parseOffset,
  parsePage,
  parseSuggestionLimit,
  searchParamsToRecord,
} from "@/lib/search-params";
import { getSession } from "@/lib/session";

/** Backs two callers with the same query.
 *
 * With `offset`: incremental loading for home-page climb search.
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
  const offsetMode = url.searchParams.has("offset");
  const suggestionLimit = offsetMode ? null : parseSuggestionLimit(url.searchParams);
  const withCount = url.searchParams.get("count") === "1";

  const sort = parseClimbSearchSort(searchParams);
  const filter = parseClimbSearchFilter(searchParams);
  const pageSize = suggestionLimit ?? SEARCH_PAGE_SIZE;
  const page = offsetMode ? 1 : parsePage(url.searchParams, pageSize);
  const offset = offsetMode ? parseOffset(url.searchParams) : undefined;

  if (page === null || offset === null) {
    return NextResponse.json(
      suggestionLimit === null
        ? {
            climbs: [],
            hasNextPage: false,
            sendStats: {},
            areaBreadcrumbs: {},
            sentClimbIds: [],
          }
        : { climbs: [] },
    );
  }

  const db = await getDb();
  const queryParams = toSearchClimbsQueryParams(filter, sort);
  const [results, session] = await Promise.all([
    searchClimbs(db, queryParams, page, pageSize, offset),
    suggestionLimit === null ? getSession() : Promise.resolve(null),
  ]);

  if (suggestionLimit !== null) {
    return NextResponse.json({ climbs: results.climbs.slice(0, suggestionLimit) });
  }

  const [sendStats, areaBreadcrumbs, count, sentClimbIds] = await Promise.all([
    getClimbSendStats(
      db,
      results.climbs.map((c) => c.id),
    ),
    getAreaBreadcrumbs(
      db,
      results.climbs.map((c) => c.areaId),
    ),
    withCount ? countSearchClimbs(db, queryParams) : Promise.resolve(undefined),
    session
      ? getUserSentClimbIds(
          db,
          session.user.id,
          results.climbs.map((climb) => climb.id),
        )
      : Promise.resolve(undefined),
  ]);

  return NextResponse.json({
    ...results,
    hasNextPage:
      results.hasNextPage &&
      !(offsetMode
        ? offsetReachesPaginationLimit(offset ?? 0, pageSize)
        : pageReachesPaginationLimit(page, pageSize)),
    sendStats,
    areaBreadcrumbs,
    count,
    sentClimbIds: sentClimbIds ? [...sentClimbIds] : undefined,
  });
}
