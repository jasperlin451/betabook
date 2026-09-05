import { eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema";

export async function getUser(db: Database, id: string) {
  return db.select().from(user).where(eq(user.id, id)).get();
}

/** Batch lookup for the review queue — one IN query for a page's worth of
 * requester names instead of one getUser round-trip per row. */
export async function getUsersByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(user).where(inArray(user.id, ids)).all();
}
