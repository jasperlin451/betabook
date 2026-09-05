import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import type { Area } from "@/db/queries/areas";
import { adminAreaScopes, areas, changeRequests, changeRequestApprovals } from "@/db/schema";

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type ChangeRequestApproval = typeof changeRequestApprovals.$inferSelect;

/** The areas an admin was granted directly (each grant covers its whole
 * subtree — see isAdminForArea in lib/moderation.ts). Just the granted rows,
 * not the expanded tree: this feeds the "areas you moderate" line on the
 * review queue. */
export async function getManagedAreas(db: Database, userId: string): Promise<Area[]> {
  const rows = await db
    .select({ area: areas })
    .from(adminAreaScopes)
    .innerJoin(areas, eq(areas.id, adminAreaScopes.areaId))
    .where(eq(adminAreaScopes.userId, userId))
    .orderBy(areas.name)
    .all();
  return rows.map((row) => row.area);
}

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

/** Every admin who has approved this request so far — the raw material for
 * the coverage check (changeRequestCoverage in lib/moderation.ts), which
 * decides whether these approvals collectively cover every involved area. */
export async function getChangeRequestApprovals(
  db: Database,
  requestId: number,
): Promise<ChangeRequestApproval[]> {
  return db
    .select()
    .from(changeRequestApprovals)
    .where(eq(changeRequestApprovals.requestId, requestId))
    .orderBy(changeRequestApprovals.createdAt)
    .all();
}
