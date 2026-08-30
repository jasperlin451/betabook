import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, searchAreas } from "@/db/queries";
import { parseSuggestionLimit } from "@/lib/search-params";

/** Backs two callers with the same query.
 *
 * Without `limit`: incremental "load more" for home-page area search — the
 * initial page is server-rendered (app/page.tsx); this backs subsequent
 * pages.
 *
 * With `limit`: suggestion mode for the area typeaheads. `searchAreas`
 * already returns each row's `ancestorPath`, which is the only context a
 * popover row shows, so the breadcrumb pass is skipped — it was always
 * re-deriving what the search had in hand. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);
  const limit = parseSuggestionLimit(url.searchParams);

  const db = await getDb();
  const results = await searchAreas(db, name, page);

  if (limit !== null) {
    return NextResponse.json({ areas: results.areas.slice(0, limit) });
  }

  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    results.areas.map((a) => a.id),
  );

  return NextResponse.json({ ...results, areaBreadcrumbs });
}
