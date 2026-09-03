"use client";

import { Button, Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useState } from "react";

import { ClimbPicker } from "@/components/climb-picker";
import { SendForm } from "@/components/send-form";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { Grade } from "@/components/ui/grade";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { ClimbWithAreaName, EditableSend, SendableClimb } from "@/db/queries";
import { formatGrade } from "@/lib/grades";

type SendFormDrawerProps = {
  /** The climb the send is written against. Omitted where the surface isn't
   * about one climb (a profile's "Log Send"), in which case the drawer opens
   * on the climb picker and the form follows once one is chosen. */
  climb?: SendableClimb;
  existingSend?: EditableSend;
  /** Passed through to the picker — only meaningful in unbound mode. */
  sentClimbIds?: Set<number>;
  state: UseOverlayStateReturn;
};

/** The create-a-send and edit-a-send forms both live in this same drawer
 * shell — only the SendForm inside (and the title) differ based on whether
 * existingSend is passed. Without a `climb`, a search step comes first. */
export function SendFormDrawer({ climb, existingSend, sentClimbIds, state }: SendFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <Drawer.Content>
        <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
          <Drawer.Header>
            <Drawer.Heading>{existingSend ? "Edit send" : "Log send"}</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            {climb ? (
              <SendForm climb={climb} existingSend={existingSend} onDone={state.close} />
            ) : (
              // No key needed to reset the picked climb between openings:
              // Drawer.Backdrop is a react-aria ModalOverlay, which renders
              // nothing while closed, so everything below unmounts with it.
              <PickThenLogSend sentClimbIds={sentClimbIds} onDone={state.close} />
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

/** Find a climb, then log against it. The picked climb stays named above the
 * form — the form itself shows nothing that identifies it. */
function PickThenLogSend({
  sentClimbIds,
  onDone,
}: {
  sentClimbIds?: Set<number>;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<ClimbWithAreaName | null>(null);

  if (!picked) {
    return <ClimbPicker onPick={setPicked} sentClimbIds={sentClimbIds} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{picked.name}</p>
          <p className="truncate text-xs text-muted">{picked.areaName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DisciplineChip type={picked.type} />
          <Grade>{formatGrade(picked.type, picked.grade)}</Grade>
          <Button size="sm" variant="ghost" onPress={() => setPicked(null)}>
            Change
          </Button>
        </div>
      </div>
      <SendForm climb={picked} onDone={onDone} />
    </div>
  );
}
