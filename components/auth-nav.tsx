"use client";

import { Link } from "@heroui/react";
import { clsx } from "clsx";
import { authClient } from "@/lib/auth-client";
import { useMounted } from "@/hooks/use-mounted";

type AuthNavProps = {
  direction?: "row" | "col";
  /** Fired when any of these links is pressed — the mobile drawer passes
   * its close() so a tap always dismisses it, including taps on a link to
   * the current page, where no route change happens to close it. */
  onNavigate?: () => void;
};

export function AuthNav({ direction = "row", onNavigate }: AuthNavProps) {
  // better-auth's session store can resolve from a client-side cache before
  // the first paint, while the server always renders the pending state —
  // gating on `mounted` keeps the SSR and first client render identical so
  // hydration doesn't mismatch; the real state applies right after mount.
  const mounted = useMounted();
  const { data: session, isPending } = authClient.useSession();

  if (!mounted || isPending) {
    return <span className="text-muted">&nbsp;</span>;
  }

  if (session) {
    return (
      <span className={clsx("flex", direction === "col" ? "flex-col items-start gap-4" : "items-center gap-6")}>
        <Link href="/climbs/new" onPress={onNavigate}>
          Create Climb
        </Link>
        <Link href="/areas/new" onPress={onNavigate}>
          Create Area
        </Link>
        <Link href={`/users/${session.user.id}`} onPress={onNavigate}>
          My sends
        </Link>
        <Link href="/account" onPress={onNavigate}>
          Account
        </Link>
      </span>
    );
  }

  return (
    <span className={clsx("flex gap-4", direction === "col" ? "flex-col items-start" : "items-center")}>
      <Link href="/sign-in" onPress={onNavigate}>
        Log In
      </Link>
      <Link href="/sign-up" onPress={onNavigate}>
        Sign Up
      </Link>
    </span>
  );
}
