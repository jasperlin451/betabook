"use client";

import { Button, useOverlayState } from "@heroui/react";

import { SendFormDrawer } from "@/components/send-form-drawer";
import type { EditableSend, SendableClimb } from "@/db/queries";

type EditSendButtonProps = {
  climb: SendableClimb;
  send: EditableSend;
};

/** Rendered below the stats card in place of LogSendButton once the viewer
 * has already logged this climb (see app/climbs/[id]/page.tsx) — opens the
 * shared SendFormDrawer in edit mode, the same wiring as the row-level
 * SendActionsMenu's Edit item. */
export function EditSendButton({ climb, send }: EditSendButtonProps) {
  const state = useOverlayState();

  return (
    <>
      <Button fullWidth variant="ghost" onPress={state.open}>
        Edit send
      </Button>
      <SendFormDrawer climb={climb} existingSend={send} state={state} />
    </>
  );
}
