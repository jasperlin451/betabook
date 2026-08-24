"use client";

import { useTransition } from "react";
import { Button, useOverlayState } from "@heroui/react";
import { SendFormDrawer } from "@/components/send-form-drawer";
import { deleteSend } from "@/db/mutations";
import type { Climb, Send } from "@/db/queries";

type SendPanelProps = {
  climb: Climb;
  existingSend: Send | null;
};

export function SendPanel({ climb, existingSend }: SendPanelProps) {
  const state = useOverlayState();
  const [pending, startTransition] = useTransition();

  // Creating a first send is handled by <LogSendButton> near the stats card.
  if (!existingSend) return null;

  function handleDelete() {
    startTransition(async () => {
      await deleteSend(existingSend!.id);
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-secondary p-4">
      <p className="flex-1 text-sm">You sent this climb on {existingSend.dateSent}.</p>
      <Button variant="ghost" onPress={state.open}>
        Edit
      </Button>
      <Button variant="ghost" onPress={handleDelete} isDisabled={pending}>
        Delete
      </Button>
      <SendFormDrawer climb={climb} existingSend={existingSend} state={state} />
    </div>
  );
}
