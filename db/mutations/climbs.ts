"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb, getDbAndContext } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { getArea, getClimb } from "@/db/queries";
import { recomputeAreaTree } from "@/db/reindex-areas";
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
    const { db, ctx } = await getDbAndContext();

    const area = parseId(areaId) === null ? undefined : await getArea(db, areaId);
    if (!area) throw new ActionError("Area not found");

    // climbs_fts stays in sync via triggers (drizzle/migrations/
    // 0014_fts_sync_triggers.sql), atomically within this same statement.
    // The denormalized lft/rght copy comes from a correlated subquery, not
    // the `area` row read above: a concurrent insertAreaIntoTree splice can
    // shift this area's bounds between that read and this INSERT, and a
    // stale copy would leave the climb mismatched with its area — invisible
    // to ancestors' subtree listings, or worse, inside a shifted sibling's
    // range — until the next full recompute.
    const input = validateNewClimbInput(readClimbFormData(formData));
    const [{ id }] = await db
      .insert(climbs)
      .values({
        areaId,
        lft: sql`(SELECT ${areas.lft} FROM ${areas} WHERE ${areas.id} = ${areaId})`,
        rght: sql`(SELECT ${areas.rght} FROM ${areas} WHERE ${areas.id} = ${areaId})`,
        ...input,
      })
      .returning({ id: climbs.id });

    // createArea now splices real bounds in synchronously (see
    // insertAreaIntoTree), so app-created areas are never 0/0 — this
    // placeholder state only remains for seeded data that hasn't been
    // reindexed yet (scripts/reindex-areas.ts). A climb created into such
    // an area copies the placeholder and would stay invisible to subtree
    // queries until some recompute happens to run — so schedule the repair
    // here rather than relying on one.
    if (area.lft === 0 && area.rght === 0) {
      ctx.waitUntil(
        recomputeAreaTree(db).catch((err) =>
          console.error(`recomputeAreaTree failed after createClimb(${id}) into stale area ${areaId}`, err),
        ),
      );
    }

    revalidatePath(`/areas/${areaId}`);
    revalidatePath("/");
    refresh();
    return id;
  });
}
