import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, getClimbSendStats, searchClimbs } from "@/db/queries";
import {
  parseClimbSearchFilter,
  parseClimbSearchSort,
  toSearchClimbsQueryParams,
} from "@/lib/climb-search-filter";
import { searchParamsToRecord } from "@/lib/search-params";

/** Incremental "load more" for home-page climb search — the initial page is
 * server-rendered (app/page.tsx); this backs subsequent pages so result #26
 * is reachable without shipping unbounded results in the first paint. Takes
 * the same query params as the page itself (see
 * climbSearchFilterToSearchParams) plus `page`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);

  const sort = parseClimbSearchSort(searchParams);
  const filter = parseClimbSearchFilter(searchParams);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);

  const db = await getDb();
  const results = await searchClimbs(db, toSearchClimbsQueryParams(filter, sort), page);
  const [sendStats, areaBreadcrumbs] = await Promise.all([
    getClimbSendStats(db, results.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, results.climbs.map((c) => c.areaId)),
  ]);

  return NextResponse.json({ ...results, sendStats, areaBreadcrumbs });
}
