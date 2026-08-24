"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { areas } from "@/db/schema";
import { getArea } from "@/db/queries";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
import { pickFormFields } from "@/lib/validation";

const AREA_FORM_FIELDS = ["name", "description"] as const;

function readAreaFormData(formData: FormData): RawAreaInput {
  return pickFormFields(formData, AREA_FORM_FIELDS);
}

export async function updateArea(areaId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = await getArea(db, areaId);
  if (!existing) throw new Error("Area not found");

  const input = validateAreaInput(readAreaFormData(formData));
  await db.update(areas).set(input).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
  refresh();
}
