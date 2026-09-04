"use client";

import { Button, Menu, useOverlayState } from "@heroui/react";
import { CirclePlus, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestAreaDelete } from "@/actions";
import { AreaEditRequestDrawer } from "@/components/area-edit-request-drawer";
import { AreaFormDrawer } from "@/components/area-form-drawer";
import { AreaReparentDialog } from "@/components/area-reparent-dialog";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { Area } from "@/db/queries";

type AreaHeaderActionsProps = {
  area: Area;
};

/** An area's editor actions, beside its title. Adding a climb or a subarea
 * are the two things people come to an area page to do, so they're buttons.
 * Description-only edits are the pencil next to AreaDescription instead
 * (unrestricted for every signed-in user); everything behind the "..." here
 * — a full rename, or deletion — is moderation-gated (see
 * actions/moderation.ts): applied immediately for an admin, otherwise
 * queued for review. */
export function AreaHeaderActions({ area }: AreaHeaderActionsProps) {
  const router = useRouter();
  const addClimbState = useOverlayState();
  const addSubareaState = useOverlayState();
  const editState = useOverlayState();
  const reparentState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePendingNotice, setDeletePendingNotice] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await requestAreaDelete(area.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      if (result.value.status === "pending") {
        setDeletePendingNotice(
          "An admin needs to approve this before the area is actually removed.",
        );
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
            if (key === "edit") editState.open();
            if (key === "reparent") reparentState.open();
            if (key === "delete") {
              setDeleteError(null);
              setDeletePendingNotice(null);
              deleteState.open();
            }
          }}
        >
          <Menu.Item id="edit">Request full edit…</Menu.Item>
          <Menu.Item id="reparent">Change parent…</Menu.Item>
          <Menu.Item id="delete">Delete</Menu.Item>
        </ActionsMenu>
      </div>
      <ClimbFormDrawer areaId={area.id} state={addClimbState} />
      <AreaFormDrawer parentId={area.id} state={addSubareaState} />
      <AreaEditRequestDrawer area={area} state={editState} />
      <AreaReparentDialog areaId={area.id} state={reparentState} />
      <ConfirmDeleteDialog
        noun="area"
        state={deleteState}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
        pendingNotice={deletePendingNotice}
      />
    </>
  );
}
