"use server";

import { getDb } from "@/db/client";
import { getArea, getClimb } from "@/db/queries";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
import { validateClimbEditInput, type RawClimbInput } from "@/lib/climbs";
import {
  applyAreaDelete,
  applyAreaEdit,
  applyClimbDelete,
  applyClimbEdit,
  assertAreaDeletable,
  assertClimbDeletable,
  submitChangeRequest,
  type GatedActionResult,
} from "@/lib/moderation";
import { parseId } from "@/lib/parse-id";
import { isAdmin, requireSession } from "@/lib/session";
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

    if (isAdmin(session)) {
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

    if (isAdmin(session)) {
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

    if (isAdmin(session)) {
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

    if (parseId(climbId) === null) throw new ActionError("Climb not found");

    if (isAdmin(session)) {
      await applyClimbDelete(db, climbId);
      return { status: "applied" };
    }

    await assertClimbDeletable(db, climbId);
    await submitChangeRequest(db, "climb_delete", climbId, session.user.id, {});
    return { status: "pending" };
  });
}
