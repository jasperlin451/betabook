"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestClimbMerge } from "@/actions";
import { ClimbPicker } from "@/components/climb-picker";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { ClimbWithAreaName } from "@/db/queries";
import { climbHref } from "@/lib/slug";

type ClimbMergeDrawerProps = {
  climbId: number;
  state: UseOverlayStateReturn;
};

/** Lets a viewer fold a duplicate climb into another one — the picked climb
 * survives with this climb's sends merged into it (see
 * actions/moderation.ts's requestClimbMerge). Gated the same as every other
 * structural change: applies immediately for an admin, otherwise queues a
 * change request. Attribute overrides on the surviving climb aren't exposed
 * here yet — the action supports them, but merging as-is and following up
 * with a normal edit covers this first pass. */
export function ClimbMergeDrawer({ climbId, state }: ClimbMergeDrawerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePick(target: ClimbWithAreaName): void {
    setError(null);
    startTransition(async () => {
      const result = await requestClimbMerge(climbId, target.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.value.status === "pending") {
        setPendingNotice("An admin needs to approve this before the climbs actually merge.");
        return;
      }
      state.close();
      router.push(climbHref(target.id, target.name));
    });
  }

  function handleOpenChange(isOpen: boolean) {
    state.setOpen(isOpen);
    if (!isOpen) {
      setError(null);
      setPendingNotice(null);
    }
  }

  return (
    <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={handleOpenChange}>
      <Drawer.Content>
        <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
          <Drawer.Header>
            <Drawer.Heading>Merge into another climb</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            {pendingNotice ? (
              <p className="text-sm text-muted">{pendingNotice}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  This climb and its sends fold into whichever one you pick — it won&apos;t exist
                  separately once the merge lands.
                </p>
                <ClimbPicker onPick={handlePick} />
                {error && <p className="text-sm text-danger">{error}</p>}
                {pending && <p className="text-sm text-muted">Merging…</p>}
              </div>
            )}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
