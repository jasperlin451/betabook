"use server";

import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { searchAreas } from "@/db/queries";

export async function searchAreasForPicker(name: string) {
  await requireSession();
  const db = await getDb();
  // The picker is a top-matches typeahead, not a browsable list — the first
  // page is plenty, and refining the query is how a user narrows it.
  const { areas } = await searchAreas(db, name);
  return areas;
}
