"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { ClimbForm } from "@/components/climb-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { Climb } from "@/db/queries";

type ClimbFormDrawerProps = {
  areaId: number;
  climb?: Climb;
  state: UseOverlayStateReturn;
};

export function ClimbFormDrawer({ areaId, climb, state }: ClimbFormDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{climb ? "Edit Climb" : "Add Climb"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <ClimbForm areaId={areaId} climb={climb} onDone={state.close} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
