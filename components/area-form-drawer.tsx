"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { AreaForm } from "@/components/area-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { Area } from "@/db/queries";

type AreaFormDrawerProps = {
  area: Area;
  state: UseOverlayStateReturn;
};

export function AreaFormDrawer({ area, state }: AreaFormDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>Edit Area</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <AreaForm area={area} onDone={state.close} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
