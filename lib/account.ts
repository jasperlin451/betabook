import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { changeRequests, sends } from "@/db/schema";

/** Explicit cleanup used by Better Auth's beforeDelete hook. Local D1
 * cascades also fire aggregate triggers; this pre-delete is retained until
 * account deletion is verified end-to-end in the deployed runtime. */
export async function deleteAccountSends(db: Database, userId: string): Promise<void> {
  await db.delete(sends).where(eq(sends.userId, userId));
}

/** Deletes the user's *pending* change requests ahead of the user row —
 * nobody is left to hear a decision on them. Decided rows deliberately
 * survive: requested_by is a set-null FK (see drizzle/schema/moderation.ts),
 * so the audit trail of applied structural changes outlives the account. */
export async function deleteAccountPendingChangeRequests(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .delete(changeRequests)
    .where(and(eq(changeRequests.requestedBy, userId), eq(changeRequests.status, "pending")));
}
