"use client";

import { useCallback, useMemo, useRef } from "react";
import type { UseOverlayStateReturn } from "@heroui/react";

export type UnsavedChangesGuard = {
  /** Pass to Drawer.Root in place of the raw overlay state — every close
   * path (Esc, backdrop click, the X CloseTrigger, drag-to-dismiss) funnels
   * through react-aria's onOpenChange and gets intercepted here. */
  state: UseOverlayStateReturn;
  /** For the form inside the drawer to report whether it currently holds
   * unsaved edits (current values differ from the seeded values). */
  onDirtyChange: (dirty: boolean) => void;
  /** Close without the discard prompt — for after a successful save, when
   * the edits aren't being discarded. */
  closeWithoutPrompt: () => void;
};

const CONFIRM_MESSAGE = "Discard unsaved changes?";

/** Wraps a HeroUI overlay state so that dismissing the drawer while its form
 * holds unsaved edits asks for confirmation first. HeroUI's Drawer.Root maps
 * the state to react-aria's controlled `isOpen`/`onOpenChange`, so Esc,
 * backdrop click, the CloseTrigger, and drag-to-dismiss all call our
 * `setOpen(false)` — declining the prompt simply leaves `isOpen` true and
 * the drawer stays open. */
export function useUnsavedChangesGuard(state: UseOverlayStateReturn): UnsavedChangesGuard {
  const dirtyRef = useRef(false);
  const { isOpen, setOpen: rawSetOpen, close: rawClose } = state;

  const setOpen = useCallback(
    (nextIsOpen: boolean) => {
      if (!nextIsOpen && dirtyRef.current && !window.confirm(CONFIRM_MESSAGE)) return;
      // The form unmounts with the drawer (see ClimbFormDrawer), so a
      // confirmed discard also resets the flag for the next open.
      if (!nextIsOpen) dirtyRef.current = false;
      rawSetOpen(nextIsOpen);
    },
    [rawSetOpen],
  );

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const closeWithoutPrompt = useCallback(() => {
    dirtyRef.current = false;
    rawClose();
  }, [rawClose]);

  const guardedState = useMemo<UseOverlayStateReturn>(
    () => ({
      isOpen,
      setOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!isOpen),
    }),
    [isOpen, setOpen],
  );

  return useMemo(
    () => ({ state: guardedState, onDirtyChange, closeWithoutPrompt }),
    [guardedState, onDirtyChange, closeWithoutPrompt],
  );
}
