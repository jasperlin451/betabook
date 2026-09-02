"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ClimbForm } from "@/components/climb-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { Climb } from "@/db/queries";

type ClimbFormDrawerProps = {
  areaId: number;
  climb?: Climb;
  state: UseOverlayStateReturn;
};

export function ClimbFormDrawer({ areaId, climb, state }: ClimbFormDrawerProps) {
  const router = useRouter();

  function handleDone(climbId: number) {
    state.close();
    // Editing an existing climb just closes the drawer in place; creating a
    // new one lands the viewer on it, same as the standalone /climbs/new page.
    if (!climb) router.push(`/climbs/${climbId}`);
  }

  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{climb ? "Edit climb" : "Add climb"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <ClimbForm areaId={areaId} climb={climb} onDone={handleDone} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
