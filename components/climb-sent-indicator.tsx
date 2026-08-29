"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CircleCheck, CirclePlus } from "lucide-react";
import type { Climb } from "@/db/queries";
import { SendFormDrawer } from "@/components/send-form-drawer";

/** Leading-slot indicator: a static check if the viewer has already sent
 * this climb, or a compact trigger opening the same create-send drawer used
 * on the climb page (SendFormDrawer via LogSendButton's create-mode usage)
 * if not. Only ever rendered for a signed-in viewer (see `sentClimbIds` on
 * ClimbListProps) — instantiated as a real per-row component, not called as
 * a plain function in `.map()`, so useOverlayState here is a normal
 * one-hook-per-row-component pattern, not a hooks-in-a-loop violation. */
export function ClimbSentIndicator({ climb, sent }: { climb: Climb; sent: boolean }) {
  const state = useOverlayState();

  if (sent) {
    return (
      <span
        title="You've sent this climb"
        aria-label="You've sent this climb"
        className="flex size-8 shrink-0 items-center justify-center"
      >
        <CircleCheck className="size-5 text-success-soft-foreground" aria-hidden />
      </span>
    );
  }

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="Log send"
        onPress={state.open}
        className="shrink-0"
      >
        <CirclePlus className="size-5" />
      </Button>
      <SendFormDrawer climb={climb} state={state} />
    </>
  );
}
