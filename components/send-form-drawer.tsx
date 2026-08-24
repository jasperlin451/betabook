"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { SendForm } from "@/components/send-form";
import type { EditableSend, SendableClimb } from "@/db/queries";

type SendFormDrawerProps = {
  climb: SendableClimb;
  existingSend?: EditableSend;
  state: UseOverlayStateReturn;
};

/** The create-a-send and edit-a-send forms both live in this same drawer
 * shell — only the SendForm inside (and the title) differ based on whether
 * existingSend is passed. */
export function SendFormDrawer({ climb, existingSend, state }: SendFormDrawerProps) {
  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>{existingSend ? "Edit Send" : "Log a Send"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <SendForm climb={climb} existingSend={existingSend} onDone={state.close} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  );
}
