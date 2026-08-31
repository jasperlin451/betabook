"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { exportSendsCsv } from "@/db/actions";
import { downloadCsv } from "@/lib/download";

export function ExportSendsButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePress() {
    setError(null);
    startTransition(async () => {
      try {
        const csvText = await exportSendsCsv();
        downloadCsv(csvText, `betabook-sends-${new Date().toISOString().slice(0, 10)}.csv`);
      } catch {
        setError("Couldn't export your sends. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onPress={handlePress} isDisabled={isPending}>
        {isPending ? "Exporting..." : "Export Sends"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
