import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { RECENT_SENDS_PAGE_SIZE, getAreaBreadcrumbs, getRecentSends } from "@/db/queries";
import { pageReachesPaginationLimit, parsePage } from "@/lib/search-params";

/** Incremental "load more" for the home feed — the first page is
 * server-rendered (app/page.tsx); this backs subsequent pages. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parsePage(url.searchParams, RECENT_SENDS_PAGE_SIZE);

  if (page === null) {
    return NextResponse.json({ sends: [], hasMore: false, areaBreadcrumbs: {} });
  }

  const db = await getDb();
  const feed = await getRecentSends(db, page);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    feed.sends.map((send) => send.areaId),
  );

  return NextResponse.json({
    ...feed,
    hasMore:
      feed.hasMore && !pageReachesPaginationLimit(page, RECENT_SENDS_PAGE_SIZE),
    areaBreadcrumbs,
  });
}
