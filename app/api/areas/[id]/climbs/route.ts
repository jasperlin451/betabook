import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  getAreaBreadcrumbs,
  getAreaWithSubtreeSize,
  getClimbSendStats,
  getSubtreeClimbs,
  getUserSentClimbIds,
  PAGE_SIZE,
  resolveSubareaScope,
} from "@/db/queries";
import { getSession } from "@/lib/session";
import { parseAreaClimbsFilter, parseAreaClimbsSort, toSubtreeQueryFilter } from "@/lib/area-climbs-filter";
import {
  pageReachesPaginationLimit,
  parsePage,
  parseSuggestionLimit,
  searchParamsToRecord,
} from "@/lib/search-params";
import { parseId } from "@/lib/parse-id";

type RouteParams = { params: Promise<{ id: string }> };

/** Backs two callers with the same query.
 *
 * Without `limit`: incremental "load more" for an area's climb list — the
 * initial page is server-rendered (app/areas/[id]/page.tsx); this backs
 * subsequent pages so the client never has to hold more than what's actually
 * been scrolled to.
 *
 * With `limit`: suggestion mode for the area page's route typeahead, which
 * searches names within this area's subtree. Same skip-the-join-passes
 * reasoning as /api/search/climbs. */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const areaId = parseId(id);
  const url = new URL(request.url);
  const searchParams = searchParamsToRecord(url.searchParams);

  const sort = parseAreaClimbsSort(searchParams);
  const filter = parseAreaClimbsFilter(searchParams);
  const limit = parseSuggestionLimit(url.searchParams);
  const pageSize = limit ?? PAGE_SIZE;
  const page = parsePage(url.searchParams, pageSize);

  const db = await getDb();
  const area = areaId === null ? undefined : await getAreaWithSubtreeSize(db, areaId);
  if (!area) {
    // A real error shape, not a valid-looking empty page — the client checks
    // res.ok, and an empty page body would read as "end of list".
    return NextResponse.json({ error: "Area not found" }, { status: 404 });
  }

  if (page === null) {
    return NextResponse.json(
      limit === null
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

  const [listScope, session] = await Promise.all([
    resolveSubareaScope(db, area, filter.subareaId),
    limit === null ? getSession() : Promise.resolve(null),
  ]);
  const subtreeClimbs = await getSubtreeClimbs(
    db,
    listScope,
    page,
    sort,
    toSubtreeQueryFilter(filter),
    pageSize,
  );

  if (limit !== null) {
    return NextResponse.json({ climbs: subtreeClimbs.climbs.slice(0, limit) });
  }

  const [sendStats, areaBreadcrumbs, sentClimbIds] = await Promise.all([
    getClimbSendStats(db, subtreeClimbs.climbs.map((c) => c.id)),
    getAreaBreadcrumbs(db, subtreeClimbs.climbs.map((c) => c.areaId)),
    session
      ? getUserSentClimbIds(
          db,
          session.user.id,
          subtreeClimbs.climbs.map((climb) => climb.id),
        )
      : Promise.resolve(undefined),
  ]);

  return NextResponse.json({
    ...subtreeClimbs,
    hasNextPage:
      subtreeClimbs.hasNextPage && !pageReachesPaginationLimit(page, pageSize),
    sendStats,
    areaBreadcrumbs,
    sentClimbIds: sentClimbIds ? [...sentClimbIds] : undefined,
  });
}
