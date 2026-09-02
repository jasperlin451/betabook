"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";

import { SendFormDrawer } from "@/components/send-form-drawer";
import type { Climb } from "@/db/queries";

type LogSendButtonProps = {
  /** The climb being logged, where the surface is about one — the climb page
   * (rendered only for a signed-in viewer who hasn't logged it yet, see
   * app/climbs/[id]/page.tsx). Omitted on a profile, where the drawer opens
   * on a climb search first. */
  climb?: Climb;
  /** Every climb id the viewer has already logged, for the search step to
   * mark. Only read when `climb` is omitted. */
  sentClimbIds?: Set<number>;
  /** Stretches to its container — how the climb page's sidebar and empty
   * state want it, where a page header wants the button's own width. */
  fullWidth?: boolean;
};

export function LogSendButton({ climb, sentClimbIds, fullWidth }: LogSendButtonProps) {
  const state = useOverlayState();

  return (
    <>
      <Button fullWidth={fullWidth} onPress={state.open} className="gap-2">
        {/* Same icon the climb lists use for their per-row log trigger (see
         * ClimbSentIndicator). */}
        <CirclePlus className="size-5" />
        Log send
      </Button>
      <SendFormDrawer climb={climb} sentClimbIds={sentClimbIds} state={state} />
    </>
  );
}
