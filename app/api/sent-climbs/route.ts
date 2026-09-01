import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getUserSentClimbIds } from "@/db/queries";
import { getSession } from "@/lib/session";
import { MAX_SENT_CLIMB_ID_LOOKUP } from "@/lib/sent-climb-ids";
import { parseId } from "@/lib/parse-id";

/** Which of `climbIds` the signed-in viewer has sent.
 *
 * The list pages server-render sent ids for their FIRST page only, so that
 * payload stays proportional to what is visible. That leaves the rows a
 * client has since paged in with no way to hear about a send logged after
 * they loaded — the server refresh re-renders the first page and says
 * nothing about the rest. This is how those rows ask.
 *
 * Signed out is an empty answer rather than a 401: the caller is asking
 * "which of these are mine", and "none" is the honest answer for nobody. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ sentClimbIds: [] });

  const raw = new URL(request.url).searchParams.get("climbIds");
  if (!raw) return NextResponse.json({ sentClimbIds: [] });

  const parsed = raw.split(",").map((value) => parseId(value));
  const climbIds = parsed.filter((id): id is number => id !== null);
  if (climbIds.length !== parsed.length) {
    return NextResponse.json({ error: "Invalid climb id" }, { status: 400 });
  }
  if (climbIds.length > MAX_SENT_CLIMB_ID_LOOKUP) {
    return NextResponse.json({ error: "Too many climb ids" }, { status: 400 });
  }

  const db = await getDb();
  const sentClimbIds = await getUserSentClimbIds(db, session.user.id, climbIds);
  return NextResponse.json({ sentClimbIds: [...sentClimbIds] });
}
