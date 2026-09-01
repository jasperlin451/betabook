"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Menu, Tooltip, useOverlayState } from "@heroui/react";
import { CirclePlus, FolderPlus } from "lucide-react";
import { AreaFormDrawer } from "@/components/area-form-drawer";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { deleteArea } from "@/db/mutations";
import type { Area } from "@/db/queries";

type AreaHeaderActionsProps = {
  area: Area;
  /** Whether this area has no sub-areas and no climbs directly in it —
   * Delete is disabled (with a tooltip) otherwise, since Area carries no
   * denormalized count to check this client-side the way ClimbActionsMenu
   * checks climb.sendCount. */
  canDelete: boolean;
};

/** An area's editor actions, beside its title. Adding a climb or a subarea
 * are the two things people come to an area page to do, so they're buttons
 * rather than menu items — a menu makes the common case cost an extra click
 * and hides that the action exists at all. What's left behind the "..." is
 * Delete: rare, destructive, and better off slightly out of reach. Editing
 * lives on the description's own pencil (see AreaDescription). */
export function AreaHeaderActions({ area, canDelete }: AreaHeaderActionsProps) {
  const router = useRouter();
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
        <ActionsMenu
          ariaLabel="Area actions"
          onAction={(key) => {
            if (key === "delete") {
              setDeleteError(null);
              deleteState.open();
            }
          }}
        >
          <Menu.Item id="delete" isDisabled={!canDelete} textValue="Delete">
            {canDelete ? (
              "Delete"
            ) : (
              // See ClimbActionsMenu for why pointer-events-auto is needed on
              // a disabled Menu.Item's tooltip trigger.
              <Tooltip.Root delay={0}>
                <Tooltip.Trigger className="pointer-events-auto">Delete</Tooltip.Trigger>
                <Tooltip.Content>
                  Can&apos;t delete an area with sub-areas or climbs.
                </Tooltip.Content>
              </Tooltip.Root>
            )}
          </Menu.Item>
        </ActionsMenu>
      </div>
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
      <AreaFormDrawer parentId={area.id} state={addSubareaState} />
      <ConfirmDeleteDialog
        noun="area"
        state={deleteState}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
      />
    </>
  );
}
