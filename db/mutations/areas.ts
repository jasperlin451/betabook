"use server";

import { refresh, revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { getDb, getDbAndContext } from "@/db/client";
import { areas } from "@/db/schema";
import { getArea } from "@/db/queries";
import { recomputeAreaTree } from "@/db/reindex-areas";
import { validateAreaInput, type RawAreaInput } from "@/lib/areas";
import { pickFormFields } from "@/lib/validation";
import { parseId } from "@/lib/parse-id";

const AREA_FORM_FIELDS = ["name", "description"] as const;

function readAreaFormData(formData: FormData): RawAreaInput {
  return pickFormFields(formData, AREA_FORM_FIELDS);
}

export async function updateArea(areaId: number, formData: FormData) {
  await requireSession();
  const db = await getDb();

  const existing = parseId(areaId) === null ? undefined : await getArea(db, areaId);
  if (!existing) throw new Error("Area not found");

  const input = validateAreaInput(readAreaFormData(formData));
  await db.update(areas).set(input).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
  refresh();
}

/** Creates an area with placeholder lft=0/rght=0 (the seed pipeline's own
 * convention for a not-yet-indexed area) and kicks off a full-tree recompute
 * in the background rather than blocking this response on it — see
 * db/reindex-areas.ts. The new area is visible by id/parentId immediately;
 * its position among siblings and its subtree climb listing catch up once
 * the recompute lands, typically well under a second later. */
export async function createArea(parentId: number | null, formData: FormData) {
  await requireSession();

  const parent = parentId == null ? undefined : await getArea(await getDb(), parentId);
  if (parentId != null && !parent) throw new Error("Parent area not found");

  const input = validateAreaInput(readAreaFormData(formData));
  const { db, ctx } = await getDbAndContext();

  const [{ id }] = await db
    .insert(areas)
    .values({ parentId, lft: 0, rght: 0, ...input })
    .returning({ id: areas.id });
  await db.run(sql`INSERT INTO areas_fts(rowid, name) VALUES (${id}, ${input.name})`);

  ctx.waitUntil(
    recomputeAreaTree(db, {
      revalidatePaths: [`/areas/${id}`, ...(parentId != null ? [`/areas/${parentId}`] : []), "/"],
    }).catch((err) => console.error(`recomputeAreaTree failed after createArea(${id})`, err)),
  );

  if (parentId != null) revalidatePath(`/areas/${parentId}`);
  revalidatePath("/");
  refresh();
  return id;
}
