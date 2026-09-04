"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { getArea, getChangeRequest, getClimb, type ChangeRequest } from "@/db/queries";
import { changeRequests } from "@/db/schema";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
import { validateClimbEditInput, type ClimbInput, type RawClimbInput } from "@/lib/climbs";
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
  changeRequestScopeAreaId,
  isAdminForArea,
  submitChangeRequest,
  type ChangeRequestType,
  type GatedActionResult,
} from "@/lib/moderation";
import { parseId } from "@/lib/parse-id";
import { requireAdmin, requireSession } from "@/lib/session";
import { pickFormFields } from "@/lib/validation";

const AREA_EDIT_REQUEST_FIELDS = ["name", "description"] as const;
const CLIMB_EDIT_REQUEST_FIELDS = ["name", "type", "grade", "description"] as const;

function readAreaFormData(formData: FormData): RawAreaInput {
  return pickFormFields(formData, AREA_EDIT_REQUEST_FIELDS);
}

function readClimbFormData(formData: FormData): RawClimbInput {
  return pickFormFields(formData, CLIMB_EDIT_REQUEST_FIELDS);
}

/** Requests a full edit (name/discipline/grade/description) — updateArea
 * only ever touches description; this is the only path to the rest. */
export async function requestAreaEdit(
  areaId: number,
  formData: FormData,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    const existing = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!existing) throw new ActionError("Area not found");

    const input = validateAreaInput(readAreaFormData(formData));

    if (await isAdminForArea(db, session, areaId)) {
      await applyAreaEdit(db, areaId, input);
      return { status: "applied" };
    }
    await submitChangeRequest(db, "area_edit", areaId, session.user.id, input);
    return { status: "pending" };
  });
}

export async function requestAreaDelete(areaId: number): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (await isAdminForArea(db, session, areaId)) {
      await applyAreaDelete(db, areaId);
      return { status: "applied" };
    }

    await assertAreaDeletable(db, areaId);
    await submitChangeRequest(db, "area_delete", areaId, session.user.id, {});
    return { status: "pending" };
  });
}

/** Requests a full edit (name/discipline/grade/description) — updateClimb
 * only ever touches description; this is the only path to the rest. */
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

    if (await isAdminForArea(db, session, existing.areaId)) {
      await applyClimbEdit(db, climbId, input);
      return { status: "applied" };
    }
    await submitChangeRequest(db, "climb_edit", climbId, session.user.id, input);
    return { status: "pending" };
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
      return { status: "applied" };
    }

    await assertClimbDeletable(db, climbId);
    await submitChangeRequest(db, "climb_delete", climbId, session.user.id, {});
    return { status: "pending" };
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

    if (await isAdminForArea(db, session, areaId)) {
      await applyAreaReparent(db, areaId, newParentId);
      return { status: "applied" };
    }

    await assertAreaReparentable(db, areaId, newParentId);
    await submitChangeRequest(db, "area_reparent", areaId, session.user.id, { newParentId });
    return { status: "pending" };
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

    const existing = await getClimb(db, climbId);
    if (existing && (await isAdminForArea(db, session, existing.areaId))) {
      await applyClimbMove(db, climbId, newAreaId);
      return { status: "applied" };
    }

    await assertClimbMovable(db, climbId, newAreaId);
    await submitChangeRequest(db, "climb_move", climbId, session.user.id, { newAreaId });
    return { status: "pending" };
  });
}

export async function requestClimbMerge(
  sourceClimbId: number,
  targetClimbId: number,
  overrides?: Partial<Pick<ClimbInput, "name" | "grade" | "description">>,
): Promise<ActionResult<GatedActionResult>> {
  return toActionResult(async () => {
    const session = await requireSession();
    const db = await getDb();

    if (parseId(sourceClimbId) === null) throw new ActionError("Climb not found");
    if (parseId(targetClimbId) === null) throw new ActionError("Target climb not found");

    // Gated on the source's area — that's the climb (and area) actually
    // disappearing into the target.
    const existingSource = await getClimb(db, sourceClimbId);
    if (existingSource && (await isAdminForArea(db, session, existingSource.areaId))) {
      await applyClimbMerge(db, sourceClimbId, targetClimbId, overrides);
      return { status: "applied" };
    }

    await assertClimbMergeable(db, sourceClimbId, targetClimbId);
    await submitChangeRequest(db, "climb_merge", sourceClimbId, session.user.id, {
      targetClimbId,
      overrides,
    });
    return { status: "pending" };
  });
}

/** Loads the request and re-checks `isAdminForArea` for real (the review
 * queue already only shows in-scope requests, but a second admin could have
 * reviewed — or the underlying row could have been deleted by something
 * else — in the time since this page loaded). Shared by approve and reject
 * so neither can diverge on what "still reviewable" means. */
async function loadReviewableRequest(
  db: Awaited<ReturnType<typeof getDb>>,
  session: Awaited<ReturnType<typeof requireAdmin>>,
  requestId: number,
) {
  const request = await getChangeRequest(db, requestId);
  if (!request) throw new ActionError("Request not found");
  if (request.status !== "pending") throw new ActionError("This request has already been reviewed");

  const areaId = await changeRequestScopeAreaId(db, request);
  if (areaId == null) throw new ActionError("The area or climb this request affects is gone");
  if (!(await isAdminForArea(db, session, areaId))) {
    throw new ActionError("You don't manage this area");
  }
  return request;
}

// One applier per gated operation, dispatched by `request.type` — a plain
// record instead of a switch so each case stays a one-liner and adding a
// type can't accidentally fall through to another's branch.
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

export async function approveChangeRequest(requestId: number): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireAdmin();
    const db = await getDb();

    const request = await loadReviewableRequest(db, session, requestId);
    await CHANGE_REQUEST_APPLIERS[request.type](db, request);

    await db
      .update(changeRequests)
      .set({ status: "approved", reviewedBy: session.user.id, reviewedAt: new Date() })
      .where(eq(changeRequests.id, requestId));
    revalidatePath("/admin/requests");
  });
}

export async function rejectChangeRequest(requestId: number, note: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const session = await requireAdmin();
    const db = await getDb();

    await loadReviewableRequest(db, session, requestId);

    await db
      .update(changeRequests)
      .set({
        status: "rejected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNote: note.trim() || null,
      })
      .where(eq(changeRequests.id, requestId));
    revalidatePath("/admin/requests");
  });
}
