"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useRouter } from "next/navigation";

import { AreaForm } from "@/components/area-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { Area } from "@/db/queries";
import { areaHref } from "@/lib/slug";

type AreaFormDrawerProps = {
  /** Fixed parent for creating a subarea (no area picker shown). Ignored
   * when `area` is present (editing). */
  parentId?: number;
  area?: Area;
  state: UseOverlayStateReturn;
};

export function AreaFormDrawer({ parentId, area, state }: AreaFormDrawerProps) {
  const router = useRouter();

  function handleDone(areaId: number, areaName?: string) {
    state.close();
    if (!area) router.push(areaName ? areaHref(areaId, areaName) : `/areas/${areaId}`);
  }

  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{area ? "Edit area" : "Add area"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <AreaForm parentId={parentId ?? null} area={area} onDone={handleDone} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
