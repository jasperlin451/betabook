"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { climbs } from "@/db/schema";
import { getArea, getClimb } from "@/db/queries";
import {
  validateClimbInput,
  validateNewClimbInput,
  type RawClimbInput,
} from "@/lib/climbs";
import { ActionError, toActionResult, type ActionResult } from "@/lib/action-result";
import { pickFormFields } from "@/lib/validation";
import { parseId } from "@/lib/parse-id";

const CLIMB_FORM_FIELDS = ["name", "type", "grade", "description"] as const;

function readClimbFormData(formData: FormData): RawClimbInput {
  return pickFormFields(formData, CLIMB_FORM_FIELDS);
}

export async function updateClimb(climbId: number, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
    if (!existing) throw new ActionError("Climb not found");

    const input = validateClimbInput(existing, readClimbFormData(formData));
    await db.update(climbs).set(input).where(eq(climbs.id, climbId));

    revalidatePath(`/climbs/${climbId}`);
    revalidatePath(`/areas/${existing.areaId}`);
    revalidatePath("/");
    refresh();
  });
}

export async function deleteClimb(climbId: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
    if (!existing) throw new ActionError("Climb not found");
    if (existing.sendCount > 0) throw new ActionError("Can't delete a climb with logged sends");

    await db.delete(climbs).where(eq(climbs.id, climbId));

    revalidatePath(`/areas/${existing.areaId}`);
    revalidatePath("/");
    refresh();
  });
}

export async function createClimb(
  areaId: number,
  formData: FormData,
): Promise<ActionResult<number>> {
  return toActionResult(async () => {
    await requireSession();
    const db = await getDb();

    const area = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!area) throw new ActionError("Area not found");

    // climbs_fts stays in sync via triggers (drizzle/migrations/
    // 0015_fts_sync_triggers.sql), atomically within this same statement.
    // areaId alone locates the climb in the tree — subtree queries resolve
    // ancestry through areas.parentId at read time, so there's no denormalized
    // position to copy here and none to repair afterwards.
    const input = validateNewClimbInput(readClimbFormData(formData));
    const [{ id }] = await db
      .insert(climbs)
      .values({ areaId, ...input })
      .returning({ id: climbs.id });

    revalidatePath(`/areas/${areaId}`);
    revalidatePath("/");
    refresh();
    return id;
  });
}
