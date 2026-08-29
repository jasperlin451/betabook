"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useRouter } from "next/navigation";
import { ClimbForm } from "@/components/climb-form";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import { announce } from "@/components/ui/status-announcer";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { Climb } from "@/db/queries";

type ClimbFormDrawerProps = {
  areaId: number;
  climb?: Climb;
  state: UseOverlayStateReturn;
};

/** No remount `key` is needed to keep the form's seeded state fresh:
 * HeroUI's Drawer.Backdrop is react-aria-components' ModalOverlay, which
 * returns `null` whenever the overlay is closed (verified in
 * node_modules/react-aria-components — `if (!state.isOpen && !isExiting ||
 * isSSR) return null;`). Everything inside — Drawer.Content, the form and
 * its useState seeds — unmounts on close and mounts fresh on every open, so
 * abandoned edits can't linger and post-save reopens re-seed from current
 * props. This also means a closed drawer costs only a context provider (no
 * DOM, no form state), which is why action menus can render these
 * unconditionally. */
export function ClimbFormDrawer({ areaId, climb, state }: ClimbFormDrawerProps) {
  const router = useRouter();
  const guard = useUnsavedChangesGuard(state);

  function handleDone(climbId: number) {
    // A successful save isn't a discard — close without the prompt.
    guard.closeWithoutPrompt();
    // Editing an existing climb just closes the drawer in place — nothing on
    // screen says so, hence the announcement; creating a new one lands the
    // viewer on it (a navigation is its own cue), same as /climbs/new.
    if (climb) {
      announce("Changes saved.");
    } else {
      router.push(`/climbs/${climbId}`);
    }
  }

  return (
    <Drawer.Root state={guard.state}>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
            <Drawer.Header>
              <Drawer.Heading>{climb ? "Edit Climb" : "Add Climb"}</Drawer.Heading>
              <Drawer.CloseTrigger />
            </Drawer.Header>
            <Drawer.Body>
              <ClimbForm
                areaId={areaId}
                climb={climb}
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
