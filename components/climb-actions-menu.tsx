"use client";

import { Menu, useOverlayState } from "@heroui/react";

import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import type { Climb } from "@/db/queries";

type ClimbActionsMenuProps = {
  climb: Climb;
};

/** The "..." actions menu shown next to a climb's title for signed-in
 * viewers — Edit opens the climb edit drawer, which only lets the
 * description be changed. Name, discipline, and grade are immutable after
 * creation, and climbs can't be deleted. */
export function ClimbActionsMenu({ climb }: ClimbActionsMenuProps) {
  const editState = useOverlayState();

  return (
    <>
      <ActionsMenu
        ariaLabel="Climb actions"
        onAction={(key) => {
          if (key === "edit") editState.open();
        }}
      >
        <Menu.Item id="edit">Edit</Menu.Item>
      </ActionsMenu>
      <ClimbFormDrawer areaId={climb.areaId} climb={climb} state={editState} />
    </>
  );
}
