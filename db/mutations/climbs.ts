"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb, getDbAndContext } from "@/db/client";
import { climbs } from "@/db/schema";
import { getArea, getClimb } from "@/db/queries";
import { recomputeAreaTree } from "@/db/reindex-areas";
import {
  validateClimbInput,
  validateNewClimbInput,
  type RawClimbInput,
} from "@/lib/climbs";
import { pickFormFields } from "@/lib/validation";
import { parseId } from "@/lib/parse-id";

const CLIMB_FORM_FIELDS = ["name", "type", "grade", "description"] as const;

function readClimbFormData(formData: FormData): RawClimbInput {
  return pickFormFields(formData, CLIMB_FORM_FIELDS);
}

export async function updateClimb(climbId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
  if (!existing) throw new Error("Climb not found");

  const input = validateClimbInput(existing, readClimbFormData(formData));
  await db.update(climbs).set(input).where(eq(climbs.id, climbId));

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
  refresh();
}

export async function deleteClimb(climbId: number) {
  await requireSession();
  const db = await getDb();

  const existing = parseId(climbId) === null ? undefined : await getClimb(db, climbId);
  if (!existing) throw new Error("Climb not found");
  if (existing.sendCount > 0) throw new Error("Can't delete a climb with logged sends");

  await db.delete(climbs).where(eq(climbs.id, climbId));

  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
  refresh();
}

export async function createClimb(areaId: number, formData: FormData) {
  await requireSession();
  const { db, ctx } = await getDbAndContext();

  const area = parseId(areaId) === null ? undefined : await getArea(db, areaId);
  if (!area) throw new Error("Area not found");

  const input = validateNewClimbInput(readClimbFormData(formData));
  const [{ id }] = await db
    .insert(climbs)
    .values({ areaId, lft: area.lft, rght: area.rght, ...input })
    .returning({ id: climbs.id });
  await db.run(sql`INSERT INTO climbs_fts(rowid, name) VALUES (${id}, ${input.name})`);

  // The area's own createArea call already triggers a recompute, but if this
  // climb landed in the gap before that job committed (or after it already
  // exhausted its retries), it would otherwise be stuck at lft=0/rght=0
  // forever unless some unrelated area happens to be created later — so
  // give it another chance here rather than relying on that.
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
}
