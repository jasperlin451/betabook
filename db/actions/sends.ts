"use server";

import { requireSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { getAllSendsForUser } from "@/db/queries";
import { buildSendsExportCsv } from "@/lib/sends-export";

export async function exportSendsCsv(): Promise<string> {
  const session = await requireSession();
  const db = await getDb();
  const rows = await getAllSendsForUser(db, session.user.id);
  return buildSendsExportCsv(rows);
}
