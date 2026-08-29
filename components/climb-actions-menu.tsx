"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, Menu, Tooltip, useOverlayState } from "@heroui/react";
import { ClimbFormDrawer } from "@/components/climb-form-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDrawer } from "@/components/ui/confirm-drawer";
import { deleteClimb } from "@/db/mutations";
import type { Climb } from "@/db/queries";

type ClimbActionsMenuProps = {
  climb: Climb;
};

/** The "..." actions menu shown next to a climb's title for signed-in
 * viewers — Edit opens the climb edit drawer, Delete opens a confirmation
 * drawer before removing the climb (disabled with a tooltip if it has any
 * logged sends). */
export function ClimbActionsMenu({ climb }: ClimbActionsMenuProps) {
  const router = useRouter();
  const editState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const hasSends = climb.sendCount > 0;

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteClimb(climb.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      deleteState.close();
      router.push(`/areas/${climb.areaId}`);
    });
  }

  return (
    <>
      <ActionsMenu
        ariaLabel="Climb actions"
        onAction={(key) => {
          if (key === "edit") editState.open();
          if (key === "delete") {
            setDeleteError(null);
            deleteState.open();
          }
        }}
      >
        {/* Labels are wrapped in <Label> (HeroUI's data-slot="label") — the
            menu-item danger styling only colors that slot, and wrapping every
            item keeps the typography uniform across items. */}
        <Menu.Item id="edit" textValue="Edit">
          <Label>Edit</Label>
        </Menu.Item>
        <Menu.Item id="delete" variant="danger" isDisabled={hasSends} textValue="Delete">
          {hasSends ? (
            // A disabled Menu.Item gets `pointer-events: none`, which would
            // also block hover on a wrapping Tooltip.Trigger — `pointer-
            // events-auto` here re-enables hit-testing for just this inner
            // element so the tooltip still shows. Note: the item itself must
            // stay a direct child of Menu.Root for react-aria's Collection to
            // register it — wrapping the whole Menu.Item in Tooltip.Trigger
            // (rather than wrapping its label) makes it vanish from the menu.
            <Tooltip.Root delay={0}>
              <Tooltip.Trigger className="pointer-events-auto">
                <Label>Delete</Label>
              </Tooltip.Trigger>
              <Tooltip.Content>Can&apos;t delete a climb with logged sends.</Tooltip.Content>
            </Tooltip.Root>
          ) : (
            <Label>Delete</Label>
          )}
        </Menu.Item>
      </ActionsMenu>
      <ClimbFormDrawer areaId={climb.areaId} climb={climb} state={editState} />
      <ConfirmDrawer
        state={deleteState}
        heading="Delete this climb?"
        description={`Delete '${climb.name}'? This can't be undone.`}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
      />
    </>
  );
}
