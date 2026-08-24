"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";

type DeleteSendDrawerProps = {
  state: UseOverlayStateReturn;
  onConfirm: () => void;
  isPending: boolean;
};

/** Confirmation drawer for deleting a send — a separate, smaller drawer
 * from SendFormDrawer since it's not a form, just a yes/no. */
export function DeleteSendDrawer({ state, onConfirm, isPending }: DeleteSendDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Delete this send?</Drawer.Heading>
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
