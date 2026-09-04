import type { Database } from "@/db/client";
import { changeRequests, CHANGE_REQUEST_TYPES } from "@/db/schema";
import type { AreaInput } from "@/lib/areas";
import type { ClimbInput } from "@/lib/climbs";

export type ChangeRequestType = (typeof CHANGE_REQUEST_TYPES)[number];

/** The validated, type-specific fields stored as `changeRequests.payload`
 * JSON. Already run through validateAreaInput/validateClimbInput by the
 * submitting action, so approving a request never re-validates user input —
 * only re-checks that the operation is still legal (entity still exists,
 * etc). */
export type ChangeRequestPayload = {
  area_edit: AreaInput;
  area_delete: Record<string, never>;
  area_reparent: { newParentId: number };
  climb_edit: ClimbInput;
  climb_delete: Record<string, never>;
  climb_move: { newAreaId: number };
  climb_merge: { targetClimbId: number; overrides?: Partial<ClimbInput> };
};

/** Queues a change instead of applying it — the non-admin half of every
 * gated action's `isAdmin(session) ? applyX(...) : submitChangeRequest(...)`
 * branch. Returns the new request's id. */
export async function submitChangeRequest<T extends ChangeRequestType>(
  db: Database,
  type: T,
  entityId: number,
  requestedBy: string,
  payload: ChangeRequestPayload[T],
): Promise<number> {
  const [{ id }] = await db
    .insert(changeRequests)
    .values({ type, entityId, requestedBy, payload: JSON.stringify(payload) })
    .returning({ id: changeRequests.id });
  return id;
}
