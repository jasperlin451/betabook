"use client";

import { formatCount } from "@/lib/format";
import { useState } from "react";
import { Button } from "@heroui/react";
import { buildSendsExportCsv } from "@/lib/sends-export";
import { downloadCsv } from "@/lib/download";
import type { UserSendRow } from "@/db/queries";

type UserSendsPageResponse = {
  sends: UserSendRow[];
  nextCursor: { dateSent: string | null; id: number } | null;
};

/** Exports the signed-in user's full send history as a CSV — fetched in
 * pages from the same /api/users/[id]/sends route that backs the profile
 * list (with an unfiltered default filter), rather than pulling the entire
 * history into one unbounded server-action response. The CSV is assembled
 * client-side with a running row count on the button. */
export function ExportSendsButton({ userId }: { userId: string }) {
  const [exportedRows, setExportedRows] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exporting = exportedRows !== null;

  async function handlePress() {
    setError(null);
    setExportedRows(0);
    try {
      const rows: UserSendRow[] = [];
      const seenIds = new Set<number>();
      let cursor: UserSendsPageResponse["nextCursor"] = null;
      do {
        const params = new URLSearchParams();
        if (cursor) {
          params.set("afterId", String(cursor.id));
          params.set("afterDate", cursor.dateSent ?? "null");
        }
        const query = params.size > 0 ? `?${params.toString()}` : "";
        const res = await fetch(`/api/users/${userId}/sends/export${query}`);
        if (!res.ok) throw new Error(`Exporting sends failed: ${res.status}`);
        const data: UserSendsPageResponse = await res.json();
        if (data.sends.some((send) => seenIds.has(send.id))) {
          throw new Error("Export cursor did not advance");
        }
        for (const send of data.sends) seenIds.add(send.id);
        rows.push(...data.sends);
        if (data.nextCursor && data.sends.length === 0) {
          throw new Error("Export cursor did not advance");
        }
        cursor = data.nextCursor;
        setExportedRows(rows.length);
      } while (cursor);

      downloadCsv(
        buildSendsExportCsv(rows),
        `betabook-sends-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch {
      setError("Couldn't export your sends. Try again.");
    } finally {
      setExportedRows(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onPress={handlePress} isDisabled={exporting}>
        {exporting ? `Exporting… ${formatCount(exportedRows, "row")}` : "Export Sends"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
