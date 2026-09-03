"use client";

import { useCallback, useEffect, useState } from "react";

import type { BeforeInstallPromptEvent } from "@/components/mobile-app-helper-panel";
import { useDeferredComponent } from "@/hooks/use-deferred-component";
import { useMounted } from "@/hooks/use-mounted";
import {
  isMobileDevice,
  isMobileHelperDismissed,
  isStandaloneDisplay,
  setMobileHelperDismissed,
} from "@/lib/mobile-detection";

/** Module-level so its identity is stable across renders — the preload hook
 * keys its effect on the loader. */
const loadPanel = () =>
  import("@/components/mobile-app-helper-panel").then((m) => m.MobileAppHelperPanel);

export const OPEN_MOBILE_HELPER_EVENT = "betabook:open-mobile-app-helper";

/** Dispatches a global event to open the mobile app shortcut helper drawer/callout. */
export function openMobileAppHelper(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_MOBILE_HELPER_EVENT));
}

/**
 * A floating helper callout rendered on mobile screens explaining how to create
 * a Chrome (or Safari) app shortcut tailored directly to the detected OS (iOS or Android).
 *
 * Only the decision to show it lives here; the callout itself is a deferred
 * chunk (see use-deferred-component). This component sits in the root layout,
 * so on desktop — where it never renders anything — the markup and its icons
 * would otherwise be dead weight on every page.
 */
export function MobileAppHelper() {
  const mounted = useMounted();
  const [isOpen, setIsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { Component: MobileAppHelperPanel, load } = useDeferredComponent(loadPanel);

  useEffect(() => {
    if (!mounted) return;

    // Check if running already as a standalone shortcut or if user previously dismissed
    const isStandalone = isStandaloneDisplay();
    const isMobile = isMobileDevice();
    const isDismissed = isMobileHelperDismissed();

    // Show after a brief delay so the initial page paint settles
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isMobile && !isStandalone && !isDismissed) {
      timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
    }

    // Capture Chrome's beforeinstallprompt for one-tap install
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    // Allow opening via custom event (e.g. from MobileNav menu). Pulls the
    // panel in on the way, for a tap that beats the idle preload.
    function handleOpenEvent() {
      load();
      setIsOpen(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener(OPEN_MOBILE_HELPER_EVENT, handleOpenEvent);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener(OPEN_MOBILE_HELPER_EVENT, handleOpenEvent);
    };
  }, [mounted, load]);

  const handleDismiss = useCallback(() => {
    setMobileHelperDismissed(true);
    setIsOpen(false);
  }, []);

  const handleNativeInstall = useCallback(async () => {
    if (!installPrompt) return;
    const promptEvent = installPrompt;
    setInstallPrompt(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setMobileHelperDismissed(true);
        setIsOpen(false);
      }
    } catch {
      // Chrome prompt error fallback
    }
  }, [installPrompt]);

  if (!mounted || !isOpen || !MobileAppHelperPanel) {
    return null;
  }

  return (
    <MobileAppHelperPanel
      installPrompt={installPrompt}
      onDismiss={handleDismiss}
      onNativeInstall={handleNativeInstall}
    />
  );
}
