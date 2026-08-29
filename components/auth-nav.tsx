"use client";

import { clsx } from "clsx";
import { Skeleton } from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { NavLink } from "@/components/nav-link";
import { useMounted } from "@/hooks/use-mounted";

type AuthNavProps = {
  direction?: "row" | "col";
};

/** One pill per signed-in link, each sized to roughly the label it stands in
 * for ("Create Climb", "Create Area", "My sends", "Account"). The signed-in
 * set is the widest (and, for a logbook, the most common) state, so holding
 * its geometry keeps the header from reflowing when the session resolves. */
const PLACEHOLDER_WIDTHS = ["w-21", "w-20", "w-16", "w-14"] as const;

export function AuthNav({ direction = "row" }: AuthNavProps) {
  // better-auth's session store can resolve from a client-side cache before
  // the first paint, while the server always renders the pending state —
  // gating on `mounted` keeps the SSR and first client render identical so
  // hydration doesn't mismatch; the real state applies right after mount.
  const mounted = useMounted();
  const { data: session, isPending } = authClient.useSession();

  // Shared by the placeholder and the signed-in state so they occupy the
  // same geometry.
  const signedInGroupClass = clsx(
    "flex",
    direction === "col" ? "flex-col items-start gap-4" : "items-center gap-6",
  );

  if (!mounted || isPending) {
    // A div (not a span like the real states) because Skeleton renders a
    // div — the classes, not the wrapper tag, define the geometry.
    return (
      <div className={signedInGroupClass} aria-hidden>
        {PLACEHOLDER_WIDTHS.map((width) => (
          // my-0.5 + h-4 adds up to the 20px line box of a text-sm link, so
          // each pill occupies exactly one link's height in both directions.
          <Skeleton
            key={width}
            animationType="pulse"
            className={clsx("my-0.5 h-4 rounded-full", width)}
          />
        ))}
      </div>
    );
  }

  if (session) {
    return (
      <span className={signedInGroupClass}>
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
