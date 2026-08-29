"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { CONFIRM_DRAWER_WIDTH_CLASS } from "@/components/ui/layout";

type DeleteClimbDrawerProps = {
  state: UseOverlayStateReturn;
  onConfirm: () => void;
  isPending: boolean;
};

/** Confirmation drawer for deleting a climb — same shape as
 * DeleteSendDrawer, just for the climb entity. */
export function DeleteClimbDrawer({ state, onConfirm, isPending }: DeleteClimbDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${CONFIRM_DRAWER_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>Delete this climb?</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <p className="text-sm text-muted">This can&apos;t be undone.</p>
            </Drawer.Body>
            <Drawer.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={state.close} isDisabled={isPending}>
                Cancel
              </Button>
              <Button variant="danger" onPress={onConfirm} isDisabled={isPending}>
                Delete
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
