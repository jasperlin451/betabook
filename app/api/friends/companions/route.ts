import { getDb } from "@/db/client";
import { searchCompanionFriends } from "@/db/queries/journal-companions";
import { getSession } from "@/lib/session";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401, headers });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const friends = query.trim()
    ? await searchCompanionFriends(await getDb(), session.user.id, query)
    : [];
  return Response.json({ friends }, { headers });
}
