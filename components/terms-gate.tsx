"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";
import { PageTitle } from "@/components/ui/typography";
import { TERMS_REQUIRED_EVENT } from "@/lib/terms";
import { acceptTermsUrl, isTermsExemptPath } from "@/lib/terms-navigation";

const redirectBrowser = (url: string) => window.location.replace(url);

/** UX companion to the server gates. Check on navigation, focus, and active use;
 * idle tabs do not poll. A full navigation loads the latest agreement bundle. */
export function TermsGate({
  viewerId,
  initiallyRequired,
  children,
  onRedirect = redirectBrowser,
}: {
  viewerId: string | null;
  initiallyRequired: boolean;
  children: ReactNode;
  onRedirect?: (url: string) => void;
}) {
  const pathname = usePathname() ?? "/";
  const exempt = isTermsExemptPath(pathname);
  const [required, setRequired] = useState(initiallyRequired);

  useEffect(() => {
    if (!viewerId || exempt) return;
    const destination = () =>
      acceptTermsUrl(window.location.pathname + window.location.search + window.location.hash);
    if (initiallyRequired) {
      onRedirect(destination());
      return;
    }
    let disposed = false;
    let blocked = false;
    let pending = false;
    let lastChecked = -Infinity;
    const controller = new AbortController();
    const block = () => {
      if (disposed || blocked) return;
      blocked = true;
      setRequired(true);
      onRedirect(destination());
    };
    const check = async (force = false) => {
      if (pending || blocked || document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastChecked < 60_000) return;
      pending = true;
      lastChecked = Date.now();
      try {
        const response = await fetch("/api/terms/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const status: { userId?: unknown; required?: unknown } = await response.json();
        if (!disposed && status.userId === viewerId && status.required === true) block();
      } catch {
        // Request failures do not grant access: pages, APIs and actions enforce
        // acceptance independently. Permit another check on the next interaction.
        lastChecked = -Infinity;
      } finally {
        pending = false;
      }
    };
    const focus = () => {
      void check(true);
    };
    const interact = () => {
      void check();
    };
    void check(true);
    window.addEventListener(TERMS_REQUIRED_EVENT, block);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    document.addEventListener("pointerdown", interact, true);
    document.addEventListener("keydown", interact, true);
    return () => {
      disposed = true;
      controller.abort();
      window.removeEventListener(TERMS_REQUIRED_EVENT, block);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      document.removeEventListener("pointerdown", interact, true);
      document.removeEventListener("keydown", interact, true);
    };
  }, [viewerId, pathname, exempt, initiallyRequired, onRedirect]);

  if (viewerId && !exempt && (required || initiallyRequired))
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <PageTitle>Review the Terms of Service</PageTitle>
        <p>Accept the current terms before continuing to your account.</p>
        <AppLink href={acceptTermsUrl(pathname)}>Review terms</AppLink>
      </div>
    );
  return children;
}
