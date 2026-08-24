"use client";

import { useTransition } from "react";
import { Button, Menu, useOverlayState } from "@heroui/react";
import { MenuTrigger, Popover } from "react-aria-components";
import { MoreHorizontal } from "lucide-react";
import { SendFormDrawer } from "@/components/send-form-drawer";
import { DeleteSendDrawer } from "@/components/delete-send-drawer";
import { deleteSend } from "@/db/mutations";
import type { Climb, EditableSend } from "@/db/queries";

type SendActionsMenuProps = {
  climb: Climb;
  send: EditableSend;
};

/** The "..." actions menu shown on a viewer's own send row — Edit opens the
 * shared SendFormDrawer, Delete opens a confirmation drawer before removing
 * the send.
 *
 * Composed from react-aria-components' raw MenuTrigger/Popover rather than
 * HeroUI's styled Popover: HeroUI doesn't export a combined trigger for
 * Menu, and its <Popover.Content> only picks up its background/shadow
 * styling via a <Popover.Root> (DialogTrigger) ancestor — which would
 * conflict with MenuTrigger's own trigger/overlay wiring. `.popover` below
 * is the same global class that slot resolves to, applied directly. */
export function SendActionsMenu({ climb, send }: SendActionsMenuProps) {
  const editState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteSend(send.id);
      deleteState.close();
    });
  }

  return (
    <>
      <MenuTrigger>
        <Button isIconOnly variant="ghost" size="sm" aria-label="Send actions">
          <MoreHorizontal className="size-4" />
        </Button>
        <Popover className="popover" placement="bottom end">
          <Menu.Root
            onAction={(key) => {
              if (key === "edit") editState.open();
              if (key === "delete") deleteState.open();
            }}
          >
            <Menu.Item id="edit">Edit</Menu.Item>
            <Menu.Item id="delete">Delete</Menu.Item>
          </Menu.Root>
        </Popover>
      </MenuTrigger>
      <SendFormDrawer climb={climb} existingSend={send} state={editState} />
      <DeleteSendDrawer state={deleteState} onConfirm={handleDelete} isPending={pending} />
    </>
  );
}
