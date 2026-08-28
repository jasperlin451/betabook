"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { areas } from "@/db/schema";
import { getArea, getSubareas, hasClimbsInArea } from "@/db/queries";
import { insertAreaIntoTree } from "@/db/reindex-areas";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { pickFormFields } from "@/lib/validation";
import { parseId } from "@/lib/parse-id";

const AREA_FORM_FIELDS = ["name", "description"] as const;

function readAreaFormData(formData: FormData): RawAreaInput {
  return pickFormFields(formData, AREA_FORM_FIELDS);
}

export async function updateArea(areaId: number, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const existing = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!existing) throw new ActionError("Area not found");

    const input = validateAreaInput(readAreaFormData(formData));
    await db.update(areas).set(input).where(eq(areas.id, areaId));

    revalidatePath(`/areas/${areaId}`);
    if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
    revalidatePath("/");
    refresh();
  });
}

/** Creates an area at its final nested-set position synchronously (see
 * insertAreaIntoTree) rather than at a lft=0/rght=0 placeholder repaired by
 * a background recompute. The create forms navigate straight to the new
 * /areas/[id] page, so its subtree bounds must already be correct by the
 * time this returns: a pending 0/0 window meant the new page's climb list
 * matched every other pending 0/0 climb (BETWEEN 0 AND 0), ancestors
 * omitted anything created into the gap, and concurrent creates
 * cross-contaminated each other's listings. areas_fts stays in sync via
 * triggers (drizzle/migrations/0014_fts_sync_triggers.sql), atomically
 * within the insert itself. */
export async function createArea(
  parentId: number | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const parent = parentId == null ? undefined : await getArea(db, parentId);
    if (parentId != null && !parent) throw new ActionError("Parent area not found");

    const input = validateAreaInput(readAreaFormData(formData));
    const id = await insertAreaIntoTree(db, { parentId, ...input });

    if (parentId != null) revalidatePath(`/areas/${parentId}`);
    revalidatePath("/");
    refresh();
    return id;
  });
}

/** Deletes a leaf area — no sub-areas, no climbs directly in it. Doesn't
 * touch tree_version/recomputeAreaTree: removing a leaf can't invalidate any
 * other area's nested-set range (a parent's lft/rght don't need to shrink
 * to stay correct, they just end up with an unused numeric gap where the
 * leaf used to sit), so the rest of the tree stays exactly as valid as it
 * was. The areas.parentId/climbs.areaId foreign keys (onDelete: "restrict")
 * would reject this delete anyway if it weren't actually a leaf — the
 * checks below exist for a friendly error message and to let the UI
 * disable the action proactively, not because the FK can't be trusted. */
export async function deleteArea(areaId: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const existing = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!existing) throw new ActionError("Area not found");

    const subareas = await getSubareas(db, areaId);
    if (subareas.length > 0) throw new ActionError("Can't delete an area with sub-areas");
    if (await hasClimbsInArea(db, areaId)) throw new ActionError("Can't delete an area with climbs");

    await db.delete(areas).where(eq(areas.id, areaId));

    revalidatePath(`/areas/${areaId}`);
    if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
    revalidatePath("/");
    refresh();
  });
}
