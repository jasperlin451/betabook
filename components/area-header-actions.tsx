"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus, FolderPlus } from "lucide-react";

import { AreaFormDrawer } from "@/components/area-form-drawer";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import type { Area } from "@/db/queries";

type AreaHeaderActionsProps = {
  area: Area;
};

/** An area's editor actions, beside its title. Adding a climb or a subarea
 * are the two things people come to an area page to do. Areas can't be
 * deleted, and editing lives on the description's own pencil (see
 * AreaDescription), so there's nothing else here. */
export function AreaHeaderActions({ area }: AreaHeaderActionsProps) {
  const addClimbState = useOverlayState();
  const addSubareaState = useOverlayState();

  return (
    <>
      {/* Wraps rather than shrink-0: on a phone these sit on their own line
       * under the title (see AreaCragHeader), where refusing to shrink is
       * what dragged the page past the viewport edge. */}
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Button size="sm" onPress={addClimbState.open} className="gap-1.5">
          <CirclePlus className="size-4" />
          Add climb
        </Button>
        <Button size="sm" variant="outline" onPress={addSubareaState.open} className="gap-1.5">
          <FolderPlus className="size-4" />
          Add sub-area
        </Button>
      </div>
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
      <AreaFormDrawer parentId={area.id} state={addSubareaState} />
    </>
  );
}
