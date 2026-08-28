"use client";

import { useState, useTransition } from "react";
import { Menu, useOverlayState } from "@heroui/react";
import { SendFormDrawer } from "@/components/send-form-drawer";
import { DeleteSendDrawer } from "@/components/delete-send-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { deleteSend } from "@/db/mutations";
import type { EditableSend, SendableClimb } from "@/db/queries";

type SendActionsMenuProps = {
  climb: SendableClimb;
  send: EditableSend;
};

/** The "..." actions menu shown on a viewer's own send row — Edit opens the
 * shared SendFormDrawer, Delete opens a confirmation drawer before removing
 * the send. */
export function SendActionsMenu({ climb, send }: SendActionsMenuProps) {
  const editState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteSend(send.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      deleteState.close();
    });
  }

  return (
    <>
      <ActionsMenu
        ariaLabel="Send actions"
        onAction={(key) => {
          if (key === "edit") editState.open();
          if (key === "delete") {
            setDeleteError(null);
            deleteState.open();
          }
        }}
      >
        <Menu.Item id="edit">Edit</Menu.Item>
        <Menu.Item id="delete">Delete</Menu.Item>
      </ActionsMenu>
      <SendFormDrawer climb={climb} existingSend={send} state={editState} />
      <DeleteSendDrawer
        state={deleteState}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
      />
    </>
  );
}
