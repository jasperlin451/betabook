import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getAreaBreadcrumbs, getSendsForUserPage } from "@/db/queries";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";
import { searchParamsToRecord } from "@/lib/search-params";

type RouteParams = { params: Promise<{ id: string }> };

/** Incremental "load more" for a user's send history — the initial page is
 * server-rendered; this backs subsequent pages so the client never has to
 * hold more than what's actually been scrolled to. */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: userId } = await params;
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);

  const filter = parseUserSendsFilter(searchParams);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const db = await getDb();
  const page = await getSendsForUserPage(db, userId, filter, Number.isFinite(offset) ? offset : 0);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    page.sends.map((send) => send.areaId),
  );

  return NextResponse.json({ ...page, areaBreadcrumbs });
}
