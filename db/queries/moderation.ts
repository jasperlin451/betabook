import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { changeRequests } from "@/db/schema";

export type ChangeRequest = typeof changeRequests.$inferSelect;

export async function getChangeRequest(
  db: Database,
  id: number,
): Promise<ChangeRequest | undefined> {
  return db.select().from(changeRequests).where(eq(changeRequests.id, id)).get();
}

/** Oldest first — the admin queue works through requests in the order they
 * came in. `id` is a deterministic tie-breaker for requests submitted in the
 * same millisecond (requestedAt only has millisecond resolution). */
export async function getPendingChangeRequests(db: Database): Promise<ChangeRequest[]> {
  return db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.status, "pending"))
    .orderBy(changeRequests.requestedAt, changeRequests.id)
    .all();
}
