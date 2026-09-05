import { eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user, userProductTours } from "@/db/schema";

export async function getUser(db: Database, id: string) {
  return db.select().from(user).where(eq(user.id, id)).get();
}

/** Batch lookup for the review queue — one IN query for a page's worth of
 * requester names instead of one getUser round-trip per row. */
export async function getUsersByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(user).where(inArray(user.id, ids)).all();
}

export async function getProductTourState(db: Database, id: string) {
  const [owner, progress] = await Promise.all([
    db.select({ returning: user.productTourReturning }).from(user).where(eq(user.id, id)).get(),
    db
      .select({
        tourId: userProductTours.tourId,
        version: userProductTours.version,
        status: userProductTours.status,
      })
      .from(userProductTours)
      .where(eq(userProductTours.userId, id)),
  ]);
  return owner ? { returning: owner.returning, progress } : null;
}
