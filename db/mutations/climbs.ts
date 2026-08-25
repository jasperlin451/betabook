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
import { pickFormFields } from "@/lib/validation";

const CLIMB_FORM_FIELDS = ["name", "type", "grade", "description"] as const;

function readClimbFormData(formData: FormData): RawClimbInput {
  return pickFormFields(formData, CLIMB_FORM_FIELDS);
}

export async function updateClimb(climbId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = await getClimb(db, climbId);
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

  const existing = await getClimb(db, climbId);
  if (!existing) throw new Error("Climb not found");
  if (existing.sendCount > 0) throw new Error("Can't delete a climb with logged sends");

  await db.delete(climbs).where(eq(climbs.id, climbId));

  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
  refresh();
}

export async function createClimb(areaId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const area = await getArea(db, areaId);
  if (!area) throw new Error("Area not found");

  const input = validateNewClimbInput(readClimbFormData(formData));
  const [{ id }] = await db
    .insert(climbs)
    .values({ areaId, lft: area.lft, rght: area.rght, ...input })
    .returning({ id: climbs.id });

  revalidatePath(`/areas/${areaId}`);
  revalidatePath("/");
  refresh();
  return id;
}
