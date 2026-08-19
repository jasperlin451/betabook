"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { SendForm } from "@/components/send-form";
import { deleteSend } from "@/db/mutations";
import type { Climb, Send } from "@/db/queries";

type SendPanelProps = {
  climb: Climb;
  existingSend: Send | null;
};

export function SendPanel({ climb, existingSend }: SendPanelProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!existingSend) {
    return <SendForm climb={climb} />;
  }

  if (editing) {
    return (
      <SendForm climb={climb} existingSend={existingSend} onDone={() => setEditing(false)} />
    );
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSend(existingSend!.id);
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-secondary p-4">
      <p className="flex-1 text-sm">You sent this climb on {existingSend.dateSent}.</p>
      <Button variant="ghost" onPress={() => setEditing(true)}>
        Edit
      </Button>
      <Button variant="ghost" onPress={handleDelete} isDisabled={pending}>
        Delete
      </Button>
    </div>
  );
}
