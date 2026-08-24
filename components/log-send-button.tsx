"use client";

import { Button, useOverlayState } from "@heroui/react";
import { SendFormDrawer } from "@/components/send-form-drawer";
import type { Climb } from "@/db/queries";

/** Rendered below the stats card only when the viewer is signed in and
 * hasn't logged this climb yet (see app/climbs/[id]/page.tsx). */
export function LogSendButton({ climb }: { climb: Climb }) {
  const state = useOverlayState();

  return (
    <>
      <Button fullWidth onPress={state.open}>
        Log Send
      </Button>
      <SendFormDrawer climb={climb} state={state} />
    </>
  );
}
