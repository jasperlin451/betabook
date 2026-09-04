"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";

import { JournalEntryDrawer } from "@/components/journal/journal-entry-drawer";
import type { SendableClimb } from "@/db/queries";

type LogEntryButtonProps = {
  climb?: SendableClimb & { name: string };
  sentClimbIds?: Set<number>;
  fullWidth?: boolean;
};

export function LogEntryButton({ climb, sentClimbIds, fullWidth }: LogEntryButtonProps) {
  const state = useOverlayState();

  return (
    <>
      <Button fullWidth={fullWidth} onPress={state.open} className="gap-2">
        <CirclePlus className="size-5" />
        Log
      </Button>
      <JournalEntryDrawer climb={climb} sentClimbIds={sentClimbIds} state={state} />
    </>
  );
}
