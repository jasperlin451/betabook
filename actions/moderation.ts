"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { getArea, getChangeRequest, getClimb, type ChangeRequest } from "@/db/queries";
import { changeRequests } from "@/db/schema";
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
  changeRequestCoverage,
  changeRequestScopeAreaIds,
  isAdminForAllAreas,
  isAdminForAnyArea,
  isAdminForArea,
  recordAdminApply,
  recordChangeRequestApproval,
  submitChangeRequest,
  type ChangeRequestPayload,
  type ChangeRequestType,
  type GatedActionResult,
} from "@/lib/moderation";
import { parseId } from "@/lib/parse-id";
import { isAdmin, requireAdmin, requireSession } from "@/lib/session";
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

/** Requests a full edit (name/discipline/grade) — updateClimb covers the
 * description freely; this is the only path to the rest. Stores the delta,
 * like requestAreaEdit. */
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

// --- Review ------------------------------------------------------------------

/** What an approval click did: applied the change (coverage complete) or
 * recorded the approval and left the request pending for an admin of the
 * remaining areas. */
export type ReviewDecision = { decision: "applied" | "awaiting" };

/** Loads the request and re-checks reviewability for real — the queue page
 * already filters, but a second admin could have decided it (or the entity
 * could be gone) since that page loaded. Shared by approve and reject so the
 * two can't diverge on what "still reviewable" means, with two deliberate
 * asymmetries:
 *  - approving your own request is blocked (your submission already recorded
 *    your coverage — see queueChangeRequest), but *rejecting* your own is
 *    allowed: that's withdrawing it.
 *  - a request whose entity is gone (scope []) can't be approved by anyone,
 *    but any admin may reject it — otherwise it would sit pending forever,
 *    invisible to area-scoped filtering. */
async function loadReviewableRequest(
  db: Database,
  session: Awaited<ReturnType<typeof requireAdmin>>,
  requestId: number,
  intent: "approve" | "reject",
): Promise<ChangeRequest> {
  if (parseId(requestId) === null) throw new ActionError("Request not found");
  const request = await getChangeRequest(db, requestId);
  if (!request) throw new ActionError("Request not found");
  if (request.status !== "pending") throw new ActionError("This request has already been reviewed");

  if (intent === "approve" && request.requestedBy === session.user.id) {
    throw new ActionError("You can't approve your own request");
  }

  const areaIds = await changeRequestScopeAreaIds(db, request);
  if (areaIds.length === 0) {
    if (intent === "approve") {
      throw new ActionError("The area or climb this request affects is gone");
    }
    return request; // Rejectable by any admin, to clear the queue.
  }
  if (!(await isAdminForAnyArea(db, session, areaIds))) {
    throw new ActionError("You don't manage this area");
  }
  return request;
}

// One applier per gated operation, dispatched by `request.type` — a plain
// record instead of a switch so each case stays a one-liner and adding a
// type can't accidentally fall through to another's branch. Payloads are
// re-parsed JSON; applyClimbMerge re-validates its overrides from scratch,
// and the others' apply functions re-assert every business rule.
const CHANGE_REQUEST_APPLIERS: Record<
  ChangeRequestType,
  (db: Database, request: ChangeRequest) => Promise<void>
> = {
  area_edit: (db, request) => applyAreaEdit(db, request.entityId, JSON.parse(request.payload)),
  area_delete: (db, request) => applyAreaDelete(db, request.entityId),
  area_reparent: (db, request) => {
    const { newParentId } = JSON.parse(request.payload);
    return applyAreaReparent(db, request.entityId, newParentId);
  },
  climb_edit: (db, request) => applyClimbEdit(db, request.entityId, JSON.parse(request.payload)),
  climb_delete: (db, request) => applyClimbDelete(db, request.entityId),
  climb_move: (db, request) => {
    const { newAreaId } = JSON.parse(request.payload);
    return applyClimbMove(db, request.entityId, newAreaId);
  },
  climb_merge: (db, request) => {
    const { targetClimbId, overrides } = JSON.parse(request.payload);
    return applyClimbMerge(db, request.entityId, targetClimbId, overrides);
  },
};

/** Flips pending → approved as a compare-and-set: whoever's UPDATE matches
 * the still-pending row wins; everyone else finds 0 rows changed and gets
 * "already reviewed". This is what makes concurrent reviews safe — claim
 * *before* applying, so the applier can never run twice (see
 * lib/welcome-email.ts for the same claim-first shape). */
async function claimDecision(
  db: Database,
  requestId: number,
  reviewerId: string,
  decision: "approved" | "rejected",
  note: string | null,
): Promise<boolean> {
  const claimed = await db
    .update(changeRequests)
    .set({
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note,
    })
    .where(and(eq(changeRequests.id, requestId), eq(changeRequests.status, "pending")))
    .returning({ id: changeRequests.id });
  return claimed.length > 0;
}

export async function approveChangeRequest(
  requestId: number,
): Promise<ActionResult<ReviewDecision>> {
  return toActionResult(async () => {
    const session = await requireAdmin();
    const db = await getDb();

    const request = await loadReviewableRequest(db, session, requestId, "approve");
    await recordChangeRequestApproval(db, requestId, session.user.id);

    const coverage = await changeRequestCoverage(db, request);
    if (!coverage.complete) {
      // Recorded, but an admin for the missing side(s) still has to weigh
      // in. The request stays pending; the queue page re-renders with the
      // new approval via the revalidate below.
      revalidatePath("/admin/requests");
      return { decision: "awaiting" };
    }

    if (!(await claimDecision(db, requestId, session.user.id, "approved", null))) {
      throw new ActionError("This request has already been reviewed");
    }
    try {
      await CHANGE_REQUEST_APPLIERS[request.type](db, request);
    } catch (err) {
      // The claim won but the operation itself no longer holds (entity
      // changed since the queue loaded) — put the request back so it stays
      // reviewable instead of stranding an approved-but-unapplied row.
      if (err instanceof ActionError) {
        await db
          .update(changeRequests)
          .set({ status: "pending", reviewedBy: null, reviewedAt: null })
          .where(eq(changeRequests.id, requestId));
      }
      throw err;
    }

    revalidatePath("/admin/requests");
    return { decision: "applied" };
  });
}

export async function rejectChangeRequest(requestId: number, note: unknown): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireAdmin();
    const db = await getDb();

    await loadReviewableRequest(db, session, requestId, "reject");
    const trimmedNote = typeof note === "string" ? note.trim().slice(0, 2000) || null : null;

    if (!(await claimDecision(db, requestId, session.user.id, "rejected", trimmedNote))) {
      throw new ActionError("This request has already been reviewed");
    }
    revalidatePath("/admin/requests");
  });
}
