"use client";

import { formatCount } from "@/lib/format";
import { useState } from "react";
import { Button } from "@heroui/react";
import { buildSendsExportCsv } from "@/lib/sends-export";
import { downloadCsv } from "@/lib/download";
import {
  DEFAULT_USER_SENDS_FILTER,
  MAX_USER_SENDS_LIMIT,
  userSendsFilterToSearchParams,
} from "@/lib/user-sends-filter";
import type { UserSendRow } from "@/db/queries";

type UserSendsPageResponse = {
  sends: UserSendRow[];
  hasMore: boolean;
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
      let hasMore = true;
      while (hasMore) {
        const params = userSendsFilterToSearchParams(DEFAULT_USER_SENDS_FILTER);
        params.set("offset", String(rows.length));
        // The biggest page the route will serve per request.
        params.set("limit", String(MAX_USER_SENDS_LIMIT));
        const res = await fetch(`/api/users/${userId}/sends?${params.toString()}`);
        if (!res.ok) throw new Error(`Exporting sends failed: ${res.status}`);
        const data: UserSendsPageResponse = await res.json();
        rows.push(...data.sends);
        hasMore = data.hasMore && data.sends.length > 0;
        setExportedRows(rows.length);
      }

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
