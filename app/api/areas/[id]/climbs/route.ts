import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getArea, getAreaBreadcrumbs, getClimbSendStats, getSubtreeClimbs } from "@/db/queries";
import { parseAreaClimbsFilter, parseAreaClimbsSort, toSubtreeQueryFilter } from "@/lib/area-climbs-filter";
import { searchParamsToRecord } from "@/lib/search-params";
import { parseId } from "@/lib/parse-id";

type RouteParams = { params: Promise<{ id: string }> };

/** Incremental "load more" for an area's climb list — the initial page is
 * server-rendered (app/areas/[id]/page.tsx); this backs subsequent pages so
 * the client never has to hold more than what's actually been scrolled to. */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const areaId = parseId(id);
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);

  const sort = parseAreaClimbsSort(searchParams);
  const filter = parseAreaClimbsFilter(searchParams);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page"))) || 1);

  const db = await getDb();
  const area = areaId === null ? undefined : await getArea(db, areaId);
  if (!area) {
    // A real error shape, not a valid-looking empty page — the client checks
    // res.ok, and an empty page body would read as "end of list".
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  const subtreeClimbs = await getSubtreeClimbs(db, area, page, sort, toSubtreeQueryFilter(filter));
  const [sendStats, areaBreadcrumbs] = await Promise.all([
    getClimbSendStats(db, subtreeClimbs.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, subtreeClimbs.climbs.map((c) => c.areaId)),
  ]);

  return NextResponse.json({ ...subtreeClimbs, sendStats, areaBreadcrumbs });
}
