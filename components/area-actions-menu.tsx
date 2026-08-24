"use client";

import { Button, Menu, useOverlayState } from "@heroui/react";
import { MenuTrigger, Popover } from "react-aria-components";
import { MoreHorizontal } from "lucide-react";
import { AreaFormDrawer } from "@/components/area-form-drawer";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import type { Area } from "@/db/queries";

type AreaActionsMenuProps = {
  area: Area;
};

/** The "..." actions menu shown next to an area's title for signed-in
 * viewers — Edit opens the area edit drawer, Add Climb opens the (shared
 * create/edit) climb form drawer scoped to this area. See
 * components/send-actions-menu.tsx for why MenuTrigger/Popover come from
 * react-aria-components rather than HeroUI's own Popover. */
export function AreaActionsMenu({ area }: AreaActionsMenuProps) {
  const editState = useOverlayState();
  const addClimbState = useOverlayState();

  return (
    <>
      <MenuTrigger>
        <Button isIconOnly variant="ghost" size="sm" aria-label="Area actions">
          <MoreHorizontal className="size-4" />
        </Button>
        <Popover className="popover" placement="bottom end">
          <Menu.Root
            onAction={(key) => {
              if (key === "edit") editState.open();
              if (key === "add-climb") addClimbState.open();
            }}
          >
            <Menu.Item id="edit">Edit</Menu.Item>
            <Menu.Item id="add-climb">Add Climb</Menu.Item>
          </Menu.Root>
        </Popover>
      </MenuTrigger>
      <AreaFormDrawer area={area} state={editState} />
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
    </>
  );
}
