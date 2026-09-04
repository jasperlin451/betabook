"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useState } from "react";

import { EntryKindStep, type EntryKindChoice } from "@/components/journal/entry-kind-step";
import { JournalEntryForm } from "@/components/journal/journal-entry-form";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { Grade } from "@/components/ui/grade";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { ClimbWithAreaName, SendableClimb } from "@/db/queries";
import { formatGrade } from "@/lib/grades";

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
              <ChooseThenLog sentClimbIds={sentClimbIds} onDone={state.close} />
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function ChosenStrip({ choice, onChange }: { choice: EntryKindChoice; onChange: () => void }) {
  const climb = choice.kind === "session" ? choice.climb : undefined;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {climb ? climb.name : "Training"}
        </p>
        <p className="truncate text-xs text-muted">
          {climb ? climb.areaName : "Indoor climbing, strength, or conditioning"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {climb && (
          <>
            <DisciplineChip type={climb.type} />
            <Grade>{formatGrade(climb.type, climb.grade)}</Grade>
          </>
        )}
        <Button size="sm" variant="ghost" onPress={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}

function ChooseThenLog({
  sentClimbIds,
  onDone,
}: {
  sentClimbIds?: Set<number>;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<EntryKindChoice | null>(null);

  if (!choice) {
    return <EntryKindStep sentClimbIds={sentClimbIds} onChoose={setChoice} />;
  }

  const climb: ClimbWithAreaName | undefined = choice.kind === "session" ? choice.climb : undefined;

  return (
    <div className="flex flex-col gap-4">
      <ChosenStrip choice={choice} onChange={() => setChoice(null)} />
      <JournalEntryForm
        kind={choice.kind}
        climb={climb}
        hasPriorSend={choice.kind === "session" ? choice.hasPriorSend : false}
        onDone={onDone}
      />
    </div>
  );
}
