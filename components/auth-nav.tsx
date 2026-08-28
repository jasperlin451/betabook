"use client";

import { clsx } from "clsx";
import { authClient } from "@/lib/auth-client";
import { NavLink } from "@/components/nav-link";
import { useMounted } from "@/hooks/use-mounted";

type AuthNavProps = {
  direction?: "row" | "col";
};

export function AuthNav({ direction = "row" }: AuthNavProps) {
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
        <NavLink href="/climbs/new">Create Climb</NavLink>
        <NavLink href="/areas/new">Create Area</NavLink>
        <NavLink href={`/users/${session.user.id}`}>My sends</NavLink>
        <NavLink href="/account">Account</NavLink>
      </span>
    );
  }

  return (
    <span className={clsx("flex gap-4", direction === "col" ? "flex-col items-start" : "items-center")}>
      <NavLink href="/sign-in">Log In</NavLink>
      <NavLink href="/sign-up">Sign Up</NavLink>
    </span>
  );
}
