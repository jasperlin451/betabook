"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu, Tooltip, useOverlayState } from "@heroui/react";
import { AreaFormDrawer } from "@/components/area-form-drawer";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { DeleteAreaDrawer } from "@/components/delete-area-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { deleteArea } from "@/db/mutations";
import type { Area } from "@/db/queries";

type AreaActionsMenuProps = {
  area: Area;
  /** Whether this area has no sub-areas and no climbs directly in it —
   * Delete is disabled (with a tooltip) otherwise, since Area carries no
   * denormalized count to check this client-side the way ClimbActionsMenu
   * checks climb.sendCount. */
  canDelete: boolean;
};

/** The "..." actions menu shown next to an area's title for signed-in
 * viewers — Edit opens the area edit drawer, Add Climb opens the (shared
 * create/edit) climb form drawer scoped to this area, Add Subarea opens the
 * (shared create/edit) area form drawer with this area fixed as the parent
 * (no area picker — the parent's already known from context), Delete opens
 * a confirmation drawer before removing the area (disabled with a tooltip
 * unless it's a leaf — no sub-areas or climbs). */
export function AreaActionsMenu({ area, canDelete }: AreaActionsMenuProps) {
  const router = useRouter();
  const editState = useOverlayState();
  const addClimbState = useOverlayState();
  const addSubareaState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteArea(area.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      deleteState.close();
      router.push(area.parentId != null ? `/areas/${area.parentId}` : "/");
    });
  }

  return (
    <>
      <ActionsMenu
        ariaLabel="Area actions"
        onAction={(key) => {
          if (key === "edit") editState.open();
          if (key === "add-climb") addClimbState.open();
          if (key === "add-subarea") addSubareaState.open();
          if (key === "delete") {
            setDeleteError(null);
            deleteState.open();
          }
        }}
      >
        <Menu.Item id="edit">Edit</Menu.Item>
        <Menu.Item id="add-climb">Add Climb</Menu.Item>
        <Menu.Item id="add-subarea">Add Subarea</Menu.Item>
        <Menu.Item id="delete" isDisabled={!canDelete} textValue="Delete">
          {canDelete ? (
            "Delete"
          ) : (
            // See ClimbActionsMenu for why pointer-events-auto is needed on
            // a disabled Menu.Item's tooltip trigger.
            <Tooltip.Root delay={0}>
              <Tooltip.Trigger className="pointer-events-auto">Delete</Tooltip.Trigger>
              <Tooltip.Content>Can&apos;t delete an area with sub-areas or climbs.</Tooltip.Content>
            </Tooltip.Root>
          )}
        </Menu.Item>
      </ActionsMenu>
      <AreaFormDrawer area={area} state={editState} />
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
      <AreaFormDrawer parentId={area.id} state={addSubareaState} />
      <DeleteAreaDrawer
        state={deleteState}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
      />
    </>
  );
}
