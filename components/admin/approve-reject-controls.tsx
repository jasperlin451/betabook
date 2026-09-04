"use client";

import { AlertDialog, Button, Label, TextArea, TextField, useOverlayState } from "@heroui/react";
import { useState, useTransition } from "react";

import { approveChangeRequest, rejectChangeRequest } from "@/actions";

type ApproveRejectControlsProps = {
  requestId: number;
};

/** Approve applies the change immediately (see actions/moderation.ts's
 * approveChangeRequest); reject asks for a one-line reason first, shown to
 * the requester on the decision email (lib/email.ts). Both re-check
 * `isAdminForArea` server-side — this page already only lists in-scope
 * requests, but a second admin could review the same one in the meantime. */
export function ApproveRejectControls({ requestId }: ApproveRejectControlsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const rejectState = useOverlayState();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveChangeRequest(requestId);
      if (!result.ok) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectChangeRequest(requestId, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      rejectState.close();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button size="sm" onPress={handleApprove} isDisabled={pending}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onPress={rejectState.open} isDisabled={pending}>
          Reject
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      <AlertDialog.Backdrop isOpen={rejectState.isOpen} onOpenChange={rejectState.setOpen}>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Reject this request?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <TextField value={note} onChange={setNote}>
                <Label>Reason (shown to the requester)</Label>
                <TextArea placeholder="Optional — why this doesn't work…" />
              </TextField>
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={rejectState.close} isDisabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onPress={handleReject} isDisabled={pending}>
                Reject
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
