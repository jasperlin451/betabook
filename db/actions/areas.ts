"use server";

import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { searchAreas } from "@/db/queries";

export async function searchAreasForPicker(name: string) {
  await requireSession();
  const db = await getDb();
  return searchAreas(db, name);
}
