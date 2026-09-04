"use client";

import { AlertDialog, Button } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useState, useTransition } from "react";

import { requestClimbMove } from "@/actions";
import { AreaPicker, type PickedArea } from "@/components/area-picker";

type ClimbMoveDialogProps = {
  climbId: number;
  state: UseOverlayStateReturn;
  /** Called after the climb actually moves (admin path only) — the caller
   * typically navigates to the climb's new area. */
  onDone?: () => void;
};

/** Lets a viewer move a climb to a different area. Gated the same as any
 * other structural change (see actions/moderation.ts): applies immediately
 * for an admin, otherwise queues a change request and says so instead of
 * closing as if the climb had already moved. */
export function ClimbMoveDialog({ climbId, state, onDone }: ClimbMoveDialogProps) {
  const [picked, setPicked] = useState<PickedArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const result = await requestClimbMove(climbId, picked.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.value.status === "pending") {
        setPendingNotice("An admin needs to approve this before the climb actually moves.");
        return;
      }
      state.close();
      onDone?.();
    });
  }

  function handleOpenChange(isOpen: boolean) {
    state.setOpen(isOpen);
    if (!isOpen) {
      setPicked(null);
      setError(null);
      setPendingNotice(null);
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={state.isOpen} onOpenChange={handleOpenChange}>
      <AlertDialog.Container placement="center" size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Heading>
              {pendingNotice ? "Submitted for review" : "Move to a different area"}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            {pendingNotice ? (
              <p className="text-sm text-muted">{pendingNotice}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <AreaPicker selected={picked} onSelectedChange={setPicked} />
                {error && <p className="text-sm text-danger">{error}</p>}
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer className="flex justify-end gap-2">
            {pendingNotice ? (
              <Button variant="ghost" onPress={state.close}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="ghost" onPress={state.close} isDisabled={pending}>
                  Cancel
                </Button>
                <Button onPress={handleConfirm} isDisabled={pending || !picked}>
                  Move
                </Button>
              </>
            )}
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
