import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, getRecentSends } from "@/db/queries";

/** Incremental "load more" for the home feed — the first page is
 * server-rendered (app/page.tsx); this backs subsequent pages. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);

  const db = await getDb();
  const feed = await getRecentSends(db, page);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    feed.sends.map((send) => send.areaId),
  );

  return NextResponse.json({ ...feed, areaBreadcrumbs });
}
