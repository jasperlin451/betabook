"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

/** How long a successful send stays disabled before offering "Send again" —
 * long enough to stop reflex double-clicks from emailing twice, short enough
 * that a lost email isn't a dead end. */
const RESEND_COOLDOWN_MS = 30_000;

export function ResetPasswordButton({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleClick() {
    setError(null);
    setPending(true);
    authClient.requestPasswordReset(
      { email, redirectTo: "/reset-password" },
      {
        onSuccess: () => {
          setSent(true);
          setCooldown(true);
        },
        onError: (ctx) => setError(ctx.error.message ?? "Could not send the reset email"),
        onResponse: () => setPending(false),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onPress={handleClick} isDisabled={pending || cooldown}>
        {cooldown ? "Reset email sent" : sent ? "Send again" : "Reset password"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
