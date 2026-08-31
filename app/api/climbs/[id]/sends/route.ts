import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { CLIMB_SENDS_PAGE_SIZE, getClimb, getSendsForClimb } from "@/db/queries";
import { MAX_CLIMB_SENDS_LIMIT } from "@/lib/sends";
import { parseOffset } from "@/lib/search-params";
import { parseId } from "@/lib/parse-id";

type RouteParams = { params: Promise<{ id: string }> };

/** Incremental "load more" for a climb's community-ascents list — the
 * initial page is server-rendered (app/climbs/[id]/page.tsx); this backs
 * subsequent pages so a popular climb's full send history never ships in
 * one payload. The `limit` param (see MAX_CLIMB_SENDS_LIMIT) exists for
 * ClimbSendList's post-mutation reconcile, which re-fetches everything the
 * viewer had loaded beyond page 1 in one request. */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const climbId = parseId(id);
  const url = new URL(request.url);

  const safeOffset = parseOffset(url.searchParams);
  const limit = Number(url.searchParams.get("limit"));
  const pageSize =
    Number.isInteger(limit) && limit >= 1
      ? Math.min(limit, MAX_CLIMB_SENDS_LIMIT)
      : CLIMB_SENDS_PAGE_SIZE;

  const db = await getDb();
  // A real error shape, not a valid-looking empty page — the client checks
  // res.ok, and an empty 200 would read as "end of list".
  const climb = climbId === null ? undefined : await getClimb(db, climbId);
  if (!climb) {
    return NextResponse.json({ error: "Climb not found" }, { status: 404 });
  }

  const page = await getSendsForClimb(db, climb.id, safeOffset, pageSize);
  return NextResponse.json(page);
}
