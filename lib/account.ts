import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { sends } from "@/db/schema";

/** Deletes every send belonging to a user, ahead of deleting the user row
 * itself in better-auth's `deleteUser` flow. D1 doesn't fire a table's AFTER
 * DELETE trigger for rows removed via ON DELETE CASCADE (see
 * drizzle/migrations/0014_sends_aggregate_triggers.sql), so letting
 * sends.userId's cascade from `user` do this would silently leave
 * climbs.send_count/rating_sum/rating_count inflated forever. Deleting sends
 * explicitly here, before the user row goes, lets sends_aggregates_ad fire
 * per row and keep those aggregates correct. */
export async function deleteAccountSends(db: Database, userId: string): Promise<void> {
  await db.delete(sends).where(eq(sends.userId, userId));
}
