import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, searchAreas } from "@/db/queries";

/** Incremental "load more" for home-page area search — the initial page is
 * server-rendered (app/page.tsx); this backs subsequent pages. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);

  const db = await getDb();
  const results = await searchAreas(db, name, page);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    results.areas.map((a) => a.id),
  );

  return NextResponse.json({ ...results, areaBreadcrumbs });
}
