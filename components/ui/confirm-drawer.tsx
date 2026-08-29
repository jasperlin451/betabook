"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";

type ConfirmDrawerProps = {
  state: UseOverlayStateReturn;
  /** e.g. "Delete this climb?" */
  heading: string;
  /** Should name the target so the viewer knows exactly what's being
   * removed, e.g. "Delete 'Midnight Lightning'? This can't be undone." */
  description: string;
  onConfirm: () => void;
  isPending: boolean;
  /** Failure message from the last attempt, if any — shown inline so the
   * viewer can retry or cancel. */
  error?: string | null;
};

/** Shared confirmation drawer for destructive actions — the delete flows for
 * areas, climbs, and sends all render this one component. Not a form, just a
 * yes/no, so no unsaved-changes guard here. */
export function ConfirmDrawer({
  state,
  heading,
  description,
  onConfirm,
  isPending,
  error,
}: ConfirmDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{heading}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <p className="text-sm text-muted">{description}</p>
              {error && <p className="text-sm text-danger">{error}</p>}
            </Drawer.Body>
            <Drawer.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={state.close} isDisabled={isPending}>
                Cancel
              </Button>
              <Button variant="danger" onPress={onConfirm} isDisabled={isPending}>
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
