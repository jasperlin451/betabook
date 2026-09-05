"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";

import { JournalEntryComposer } from "@/components/journal/journal-entry-composer";
import { JournalEntryForm } from "@/components/journal/journal-entry-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { SendableClimb } from "@/db/queries";

type JournalEntryDrawerProps = {
  climb?: SendableClimb & { name: string };
  sentClimbIds?: Set<number>;
  state: UseOverlayStateReturn;
};

export function JournalEntryDrawer({ climb, sentClimbIds, state }: JournalEntryDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <Drawer.Content>
        <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
          <Drawer.Header>
            <Drawer.Heading>Log entry</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            {climb ? (
              <JournalEntryForm
                kind="session"
                climb={climb}
                hasPriorSend={sentClimbIds?.has(climb.id) ?? false}
                onDone={state.close}
              />
            ) : (
              <JournalEntryComposer sentClimbIds={sentClimbIds} onDone={state.close} />
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
