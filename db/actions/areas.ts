"use server";

import { getDb } from "@/db/client";
import { searchAreas } from "@/db/queries";

export async function searchAreasForPicker(name: string) {
  const db = await getDb();
  return searchAreas(db, name);
}
