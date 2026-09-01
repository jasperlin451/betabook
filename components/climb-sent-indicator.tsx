"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";
import type { SendableClimb } from "@/db/queries";
import { SendFormDrawer } from "@/components/send-form-drawer";

/** Leading-slot indicator: a static check if the viewer has already sent
 * this climb, or a compact trigger opening the same create-send drawer used
 * on the climb page (SendFormDrawer via LogSendButton's create-mode usage)
 * if not. Only ever rendered for a signed-in viewer (see `sentClimbIds` on
 * ClimbListProps) — instantiated as a real per-row component, not called as
 * a plain function in `.map()`, so useOverlayState here is a normal
 * one-hook-per-row-component pattern, not a hooks-in-a-loop violation. */
/** The column both branches occupy. Fixed here rather than left to whatever
 * each branch happens to measure: the tick is bare markup while the trigger is
 * a HeroUI icon button, and a 4px difference between them staggered every sent
 * row's title against every unsent one. `size-9 md:size-8` mirrors
 * `.button--icon-only.button--sm` (w-9 md:w-8), which bumps its touch target
 * below md — so the box tracks the button at both breakpoints instead of
 * matching it at one and drifting at the other. */
const INDICATOR_BOX_CLASS = "flex size-9 shrink-0 items-center justify-center md:size-8";

export function ClimbSentIndicator({ climb, sent }: { climb: SendableClimb; sent: boolean }) {
  const state = useOverlayState();

  if (sent) {
    return (
      <span
        title="You've sent this climb"
        aria-label="You've sent this climb"
        className={INDICATOR_BOX_CLASS}
      >
        {/* The guidebook tick, drawn in on mount (stroke-dash draw — see
          * tick-draw in globals.css); reduced-motion users get it static. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-success-soft-foreground"
          aria-hidden
        >
          <path
            d="M4 13l5 5L20 6"
            strokeDasharray={24}
            className="motion-safe:animate-tick-draw"
          />
        </svg>
      </span>
    );
  }

  return (
    <>
      <span className={INDICATOR_BOX_CLASS}>
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
      </span>
      <SendFormDrawer climb={climb} state={state} />
    </>
  );
}
