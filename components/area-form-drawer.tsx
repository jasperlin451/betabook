"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useRouter } from "next/navigation";
import { AreaForm } from "@/components/area-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { Area } from "@/db/queries";

type AreaFormDrawerProps = {
  /** Fixed parent for creating a subarea (no area picker shown). Ignored
   * when `area` is present (editing). */
  parentId?: number;
  area?: Area;
  state: UseOverlayStateReturn;
};

/** See ClimbFormDrawer for why no remount `key` is needed here — the drawer
 * subtree (form state included) unmounts whenever the drawer is closed. */
export function AreaFormDrawer({ parentId, area, state }: AreaFormDrawerProps) {
  const router = useRouter();
  const guard = useUnsavedChangesGuard(state);

  function handleDone(areaId: number) {
    // A successful save isn't a discard — close without the prompt.
    guard.closeWithoutPrompt();
    if (!area) router.push(`/areas/${areaId}`);
  }

  return (
    <Drawer.Root state={guard.state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{area ? "Edit Area" : "Add Area"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <AreaForm
                parentId={parentId ?? null}
                area={area}
                onDone={handleDone}
                onDirtyChange={guard.onDirtyChange}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
