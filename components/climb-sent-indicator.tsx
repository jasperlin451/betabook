"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";
import type { Climb } from "@/db/queries";
import { SendFormDrawer } from "@/components/send-form-drawer";

/** Both indicator states render in this exact box so the leading column
 * never shifts row to row: it mirrors HeroUI's sm icon-only button metrics
 * (h-9/w-9, md:h-8/w-8 — see .button--sm.button--icon-only in
 * @heroui/styles), pinned here on the button too so the two can't drift
 * apart if the library's sizing changes. */
const INDICATOR_BOX = "size-9 shrink-0 md:size-8";

/** A hand-drawn tick — single stroke, round caps, with the long arm bowing
 * slightly and overshooting past the entry height the way a pencil tick in
 * a guidebook margin does. Inherits currentColor; the glyph is weighted
 * toward the bottom of the viewBox so it sits on the line like handwriting. */
function ChalkTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M2.5 9.75C3.9 10.4 5.1 11.9 5.9 13.25C7.35 9.7 10.1 5.1 13.75 2.4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Leading-slot indicator: a chalk tick if the viewer has already sent this
 * climb (foreground-colored — basalt on the light theme, chalk-white on
 * dark — sent-state reads as a tick in the margin, not a traffic light), or
 * a compact trigger opening the same create-send drawer used on the climb
 * page (SendFormDrawer via LogSendButton's create-mode usage) if not. Only
 * ever rendered for a signed-in viewer (see `sentClimbIds` on
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
        className={`flex items-center justify-center ${INDICATOR_BOX}`}
      >
        <ChalkTick className="size-5 text-foreground" />
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
        className={INDICATOR_BOX}
      >
        <CirclePlus className="size-5" />
      </Button>
      <SendFormDrawer climb={climb} state={state} />
    </>
  );
}
