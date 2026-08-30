"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";

type DeleteAreaDrawerProps = {
  state: UseOverlayStateReturn;
  onConfirm: () => void;
  isPending: boolean;
  /** Failure message from the last delete attempt, if any — shown inline so
   * the viewer can retry or cancel. */
  error?: string | null;
};

/** Confirmation drawer for deleting an area — same shape as
 * DeleteClimbDrawer, just for the area entity. */
export function DeleteAreaDrawer({ state, onConfirm, isPending, error }: DeleteAreaDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>Delete this area?</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <p className="text-sm text-muted">This can&apos;t be undone.</p>
              {error && <p className="text-sm text-danger">{error}</p>}
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
