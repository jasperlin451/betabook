"use client";

import { Menu, useOverlayState } from "@heroui/react";
import { AreaFormDrawer } from "@/components/area-form-drawer";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import type { Area } from "@/db/queries";

type AreaActionsMenuProps = {
  area: Area;
};

/** The "..." actions menu shown next to an area's title for signed-in
 * viewers — Edit opens the area edit drawer, Add Climb opens the (shared
 * create/edit) climb form drawer scoped to this area. */
export function AreaActionsMenu({ area }: AreaActionsMenuProps) {
  const editState = useOverlayState();
  const addClimbState = useOverlayState();

  return (
    <>
      <ActionsMenu
        ariaLabel="Area actions"
        onAction={(key) => {
          if (key === "edit") editState.open();
          if (key === "add-climb") addClimbState.open();
        }}
      >
        <Menu.Item id="edit">Edit</Menu.Item>
        <Menu.Item id="add-climb">Add Climb</Menu.Item>
      </ActionsMenu>
      <AreaFormDrawer area={area} state={editState} />
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
    </>
  );
}
