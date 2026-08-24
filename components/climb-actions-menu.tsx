"use client";

import { Button, Menu, useOverlayState } from "@heroui/react";
import { MenuTrigger, Popover } from "react-aria-components";
import { MoreHorizontal } from "lucide-react";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import type { Climb } from "@/db/queries";

type ClimbActionsMenuProps = {
  climb: Climb;
};

/** The "..." actions menu shown next to a climb's title for signed-in
 * viewers — Edit opens the climb edit drawer. See
 * components/send-actions-menu.tsx for why MenuTrigger/Popover come from
 * react-aria-components rather than HeroUI's own Popover. */
export function ClimbActionsMenu({ climb }: ClimbActionsMenuProps) {
  const editState = useOverlayState();

  return (
    <>
      <MenuTrigger>
        <Button isIconOnly variant="ghost" size="sm" aria-label="Climb actions">
          <MoreHorizontal className="size-4" />
        </Button>
        <Popover className="popover" placement="bottom end">
          <Menu.Root
            onAction={(key) => {
              if (key === "edit") editState.open();
            }}
          >
            <Menu.Item id="edit">Edit</Menu.Item>
          </Menu.Root>
        </Popover>
      </MenuTrigger>
      <ClimbFormDrawer areaId={climb.areaId} climb={climb} state={editState} />
    </>
  );
}
