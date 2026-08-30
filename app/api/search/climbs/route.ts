import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, getClimbSendStats, searchClimbs } from "@/db/queries";
import {
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import { parseSuggestionLimit, searchParamsToRecord } from "@/lib/search-params";

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
 * entirely rather than computed for rows nobody renders. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);
  const limit = parseSuggestionLimit(url.searchParams);

  const sort = parseClimbSearchSort(searchParams);
  const filter = parseClimbSearchFilter(searchParams);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);

  const db = await getDb();
  const results = await searchClimbs(db, toSearchClimbsQueryParams(filter, sort), page);

  if (limit !== null) {
    return NextResponse.json({ climbs: results.climbs.slice(0, limit) });
  }

  const [sendStats, areaBreadcrumbs] = await Promise.all([
    getClimbSendStats(db, results.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, results.climbs.map((c) => c.areaId)),
  ]);

  return NextResponse.json({ ...results, sendStats, areaBreadcrumbs });
}
