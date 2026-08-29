"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { SendForm } from "@/components/send-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import { announce } from "@/components/ui/status-announcer";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { EditableSend, SendableClimb } from "@/db/queries";

type SendFormDrawerProps = {
  climb: SendableClimb;
  existingSend?: EditableSend;
  state: UseOverlayStateReturn;
};

/** The create-a-send and edit-a-send forms both live in this same drawer
 * shell — only the SendForm inside (and the title) differ based on whether
 * existingSend is passed. See ClimbFormDrawer for why no remount `key` is
 * needed — the drawer subtree (form state included) unmounts on close. */
export function SendFormDrawer({ climb, existingSend, state }: SendFormDrawerProps) {
  const guard = useUnsavedChangesGuard(state);

  function handleDone() {
    guard.closeWithoutPrompt();
    // Both outcomes just close the drawer in place — nothing on screen says
    // the save happened, so tell screen readers explicitly.
    announce(existingSend ? "Changes saved." : "Send logged.");
  }

  return (
    <Drawer.Root state={guard.state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{existingSend ? "Edit Send" : "Log a Send"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <SendForm
                climb={climb}
                existingSend={existingSend}
                onDone={handleDone}
                onDirtyChange={guard.onDirtyChange}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
