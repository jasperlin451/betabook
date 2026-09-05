"use server";

import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { getArea, getClimb } from "@/db/queries";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import {
  validateClimbEditInput,
  validateClimbMergeOverrides,
  type RawClimbEditInput,
} from "@/lib/climbs";
import {
  applyAreaDelete,
  applyAreaEdit,
  applyAreaReparent,
  applyClimbDelete,
  applyClimbEdit,
  applyClimbMerge,
  applyClimbMove,
  assertAreaDeletable,
  assertAreaReparentable,
  assertClimbDeletable,
  assertClimbMergeable,
  assertClimbMovable,
  changedFields,
  isAdminForAllAreas,
  isAdminForArea,
  recordAdminApply,
  recordChangeRequestApproval,
  submitChangeRequest,
  type ChangeRequestPayload,
  type ChangeRequestType,
  type GatedActionResult,
} from "@/lib/moderation";
import { parseId } from "@/lib/parse-id";
import { isAdmin, requireSession } from "@/lib/session";
import { pickFormFields, requireTrimmed } from "@/lib/validation";

// Descriptions are deliberately absent from both edit-request forms: editing
// one is free and instant for any signed-in user (updateArea/updateClimb),
// so it never needs a request.
const CLIMB_EDIT_REQUEST_FIELDS = ["name", "type", "grade"] as const;

function readClimbFormData(formData: FormData): RawClimbEditInput {
  return pickFormFields(formData, CLIMB_EDIT_REQUEST_FIELDS);
}

type Session = Awaited<ReturnType<typeof requireSession>>;

/** The queue half of every gated action. When the requester is themselves an
 * admin (just not for every involved area — otherwise they'd have bypassed),
 * their submission doubles as their approval for whatever sides they *do*
 * manage: an admin covering the source of a move shouldn't have to approve
 * their own request from the queue, only the destination side still needs an
 * independent admin. Coverage is recomputed live at review time, so the
 * recorded approval only ever counts for areas they actually manage then. */
async function queueChangeRequest<T extends ChangeRequestType>(
  db: Database,
  session: Session,
  type: T,
  entityId: number,
  payload: ChangeRequestPayload[T],
): Promise<GatedActionResult> {
  const requestId = await submitChangeRequest(db, type, entityId, session.user.id, payload);
  if (isAdmin(session)) await recordChangeRequestApproval(db, requestId, session.user.id);
  return { status: "pending" };
}

/** Requests a rename — the one gated area edit; updateArea covers the
 * description freely. The payload is the *delta* against the area's current
 * name, so a no-op rename is rejected up front. */
export async function requestAreaEdit(
  areaId: number,
  formData: FormData,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!existing) throw new ActionError("Area not found");

    const name = requireTrimmed(formData.get("name"), "Name");
    const delta = changedFields(existing, { name });
    if (Object.keys(delta).length === 0) throw new ActionError("No changes to submit");

    if (await isAdminForArea(db, session, areaId)) {
      await applyAreaEdit(db, areaId, delta);
      await recordAdminApply(db, "area_edit", areaId, delta, session.user.id);
      return { status: "applied" };
    }
    return queueChangeRequest(db, session, "area_edit", areaId, delta);
  });
}

export async function requestAreaDelete(areaId: number): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (parseId(areaId) === null) throw new ActionError("Area not found");

    if (await isAdminForArea(db, session, areaId)) {
      await applyAreaDelete(db, areaId);
      await recordAdminApply(db, "area_delete", areaId, {}, session.user.id);
      return { status: "applied" };
    }

    await assertAreaDeletable(db, areaId);
    return queueChangeRequest(db, session, "area_delete", areaId, {});
  });
}

/** Requests a full edit (name/discipline/grade/description) — updateClimb
 * only ever touches description; this is the only path to the rest. Stores
 * the delta, like requestAreaEdit. */
export async function requestClimbEdit(
  climbId: number,
  formData: FormData,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
    if (!existing) throw new ActionError("Climb not found");

    const input = validateClimbEditInput(existing, readClimbFormData(formData));
    const delta = changedFields(existing, input);
    if (Object.keys(delta).length === 0) throw new ActionError("No changes to submit");

    if (await isAdminForArea(db, session, existing.areaId)) {
      await applyClimbEdit(db, climbId, delta);
      await recordAdminApply(db, "climb_edit", climbId, delta, session.user.id);
      return { status: "applied" };
    }
    return queueChangeRequest(db, session, "climb_edit", climbId, delta);
  });
}

export async function requestClimbDelete(
  climbId: number,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
    if (!existing) throw new ActionError("Climb not found");

    if (await isAdminForArea(db, session, existing.areaId)) {
      await applyClimbDelete(db, climbId);
      await recordAdminApply(db, "climb_delete", climbId, {}, session.user.id);
      return { status: "applied" };
    }

    await assertClimbDeletable(db, climbId);
    return queueChangeRequest(db, session, "climb_delete", climbId, {});
  });
}

export async function requestAreaReparent(
  areaId: number,
  newParentId: number,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (parseId(areaId) === null) throw new ActionError("Area not found");
    if (parseId(newParentId) === null) throw new ActionError("Parent area not found");

    // Bypass needs both sides — managing only where the area is moving from
    // or only where it's moving to doesn't get to push it across a boundary
    // half out of scope. It still queues either way; approvals then
    // accumulate until an admin has covered each side (see
    // changeRequestCoverage), starting with the requester's own sides via
    // queueChangeRequest.
    if (await isAdminForAllAreas(db, session, [areaId, newParentId])) {
      await applyAreaReparent(db, areaId, newParentId);
      await recordAdminApply(db, "area_reparent", areaId, { newParentId }, session.user.id);
      return { status: "applied" };
    }

    await assertAreaReparentable(db, areaId, newParentId);
    return queueChangeRequest(db, session, "area_reparent", areaId, { newParentId });
  });
}

export async function requestClimbMove(
  climbId: number,
  newAreaId: number,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (parseId(climbId) === null) throw new ActionError("Climb not found");
    if (parseId(newAreaId) === null) throw new ActionError("Area not found");

    // Same both-sides requirement as requestAreaReparent, above.
    const existing = await getClimb(db, climbId);
    if (existing && (await isAdminForAllAreas(db, session, [existing.areaId, newAreaId]))) {
      await applyClimbMove(db, climbId, newAreaId);
      await recordAdminApply(db, "climb_move", climbId, { newAreaId }, session.user.id);
      return { status: "applied" };
    }

    await assertClimbMovable(db, climbId, newAreaId);
    return queueChangeRequest(db, session, "climb_move", climbId, { newAreaId });
  });
}

export async function requestClimbMerge(
  sourceClimbId: number,
  targetClimbId: number,
  overrides?: unknown,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (parseId(sourceClimbId) === null) throw new ActionError("Climb not found");
    if (parseId(targetClimbId) === null) throw new ActionError("Target climb not found");

    // A merge rewrites the target too (its sends, and any overrides), so
    // bypassing takes both the source's and the target's areas — the same
    // both-sides rule as a move, of which a merge is the destructive cousin.
    const { source, target } = await assertClimbMergeable(db, sourceClimbId, targetClimbId);
    // `overrides` is client-shaped no matter what its TypeScript type says —
    // whitelist and validate it before it's stored or applied. applyClimbMerge
    // re-validates from scratch as defense in depth.
    const validated = validateClimbMergeOverrides(target, overrides);

    if (await isAdminForAllAreas(db, session, [source.areaId, target.areaId])) {
      await applyClimbMerge(db, sourceClimbId, targetClimbId, validated);
      await recordAdminApply(
        db,
        "climb_merge",
        sourceClimbId,
        { targetClimbId, overrides: validated },
        session.user.id,
      );
      return { status: "applied" };
    }

    return queueChangeRequest(db, session, "climb_merge", sourceClimbId, {
      targetClimbId,
      overrides: validated,
    });
  });
}
