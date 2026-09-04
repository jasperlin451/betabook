"use client";

import { Menu, Tooltip, useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestClimbDelete } from "@/actions";
import { ClimbEditRequestDrawer } from "@/components/climb-edit-request-drawer";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { Climb } from "@/db/queries";

type ClimbActionsMenuProps = {
  climb: Climb;
};

/** The "..." menu next to a climb's title, for structural changes.
 * Description-only edits are the pencil next to ClimbDescription instead
 * (unrestricted for every signed-in user); everything here — a full edit
 * (name/discipline/grade) or deletion — is moderation-gated (see
 * actions/moderation.ts): applied immediately for an admin, otherwise
 * queued for review. */
export function ClimbActionsMenu({ climb }: ClimbActionsMenuProps) {
  const router = useRouter();
  const editState = useOverlayState();
  const deleteState = useOverlayState();
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePendingNotice, setDeletePendingNotice] = useState<string | null>(null);
  const hasSends = climb.sendCount > 0;

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await requestClimbDelete(climb.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      if (result.value.status === "pending") {
        setDeletePendingNotice(
          "An admin needs to approve this before the climb is actually removed.",
        );
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
            setDeletePendingNotice(null);
            deleteState.open();
          }
        }}
      >
        <Menu.Item id="edit">Request full edit…</Menu.Item>
        <Menu.Item id="delete" isDisabled={hasSends} textValue="Delete">
          {hasSends ? (
            // A disabled Menu.Item gets `pointer-events: none`, which would
            // also block hover on a wrapping Tooltip.Trigger — `pointer-
            // events-auto` here re-enables hit-testing for just this inner
            // element so the tooltip still shows. Note: the item itself must
            // stay a direct child of Menu.Root for react-aria's Collection to
            // register it — wrapping the whole Menu.Item in Tooltip.Trigger
            // (rather than wrapping its label) makes it vanish from the menu.
            <Tooltip.Root delay={0}>
              <Tooltip.Trigger className="pointer-events-auto">Delete</Tooltip.Trigger>
              <Tooltip.Content>Can&apos;t delete a climb with logged sends.</Tooltip.Content>
            </Tooltip.Root>
          ) : (
            "Delete"
          )}
        </Menu.Item>
      </ActionsMenu>
      <ClimbEditRequestDrawer climb={climb} state={editState} />
      <ConfirmDeleteDialog
        noun="climb"
        state={deleteState}
        onConfirm={handleDelete}
        isPending={pending}
        error={deleteError}
        pendingNotice={deletePendingNotice}
      />
    </>
  );
}
