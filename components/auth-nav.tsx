"use client";

import { useEffect, useState } from "react";
import { Link } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function AuthNav() {
  // better-auth's session store can resolve from a client-side cache before
  // the first paint, while the server always renders the pending state —
  // gating on `mounted` keeps the SSR and first client render identical so
  // hydration doesn't mismatch; the real state applies right after mount.
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // One-time SSR/CSR reconciliation, not a derived-state sync: this fires
    // exactly once per mount to swap the server's pending placeholder for
    // the client-resolved session, so it can't cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || isPending) {
    return <span className="text-muted">&nbsp;</span>;
  }

  if (session) {
    return (
      <span className="flex items-center gap-6">
        <Link href={`/users/${session.user.id}`}>My sends</Link>
        <Link href="/account">Account</Link>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-4">
      <Link href="/sign-in">Log In</Link>
      <Link href="/sign-up">Sign Up</Link>
    </span>
  );
}
