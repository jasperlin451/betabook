"use client";

import { AlertDialog, Button } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";

type ConfirmDeleteDialogProps = {
  state: UseOverlayStateReturn;
  /** What is being deleted, as the noun the heading names ("area", "climb",
   * "send"). */
  noun: string;
  onConfirm: () => void;
  isPending: boolean;
  /** Failure message from the last delete attempt, if any — shown inline so
   * the viewer can retry or cancel. */
  error?: string | null;
};

/** The one delete confirmation: a centered alert dialog, not a bottom sheet
 * — a yes/no is a question the page asks, and a form-sized drawer holding
 * one sentence and two buttons read as a page takeover. Every destructive
 * action in the app confirms through this so the wording, the button order,
 * and the danger styling never drift between entities. */
export function ConfirmDeleteDialog({
  state,
  noun,
  onConfirm,
  isPending,
  error,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog.Root isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Delete this {noun}?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">This can&apos;t be undone.</p>
              {error && <p className="text-sm text-danger">{error}</p>}
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={state.close} isDisabled={isPending}>
                Cancel
              </Button>
              <Button variant="danger" onPress={onConfirm} isDisabled={isPending}>
                Delete
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
