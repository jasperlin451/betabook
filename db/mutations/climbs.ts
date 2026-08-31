"use server";

import { refresh, revalidatePath } from "next/cache";
import { and, eq, notExists } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
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
    const condition =
      input.type === existing.type
        ? eq(climbs.id, climbId)
        : and(
            eq(climbs.id, climbId),
            notExists(
              db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id)),
            ),
          );
    const updated = await db
      .update(climbs)
      .set(input)
      .where(condition)
      .returning({ id: climbs.id })
      .get();
    if (!updated) {
      if (!(await getClimb(db, climbId))) throw new ActionError("Climb not found");
      throw new ActionError("Can't change discipline once a climb has logged sends");
    }

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

    if (parseId(climbId) === null) throw new ActionError("Climb not found");
    const deleted = await db
      .delete(climbs)
      .where(
        and(
          eq(climbs.id, climbId),
          notExists(
            db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id)),
          ),
        ),
      )
      .returning({ areaId: climbs.areaId })
      .get();

    if (!deleted) {
      const existing = await getClimb(db, climbId);
      if (!existing) throw new ActionError("Climb not found");
      throw new ActionError("Can't delete a climb with logged sends");
    }

    revalidatePath(`/areas/${deleted.areaId}`);
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
