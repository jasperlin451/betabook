"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { exportSendsCsv } from "@/db/actions";

export function ExportSendsButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePress() {
    setError(null);
    startTransition(async () => {
      try {
        const csvText = await exportSendsCsv();
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `betabook-sends-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
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
