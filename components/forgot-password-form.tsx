"use client";

import { FORM_CARD_CLASS } from "@/components/ui/card";
import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { AppLink } from "@/components/ui/app-link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    authClient.requestPasswordReset(
      { email, redirectTo: "/reset-password" },
      {
        onSuccess: () => setDone(true),
        onError: (ctx) => setError(ctx.error.message ?? "Request failed"),
        onResponse: () => setPending(false),
      },
    );
  }

  if (done) {
    return (
      <div className={FORM_CARD_CLASS}>
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for {email}, we sent a link to reset your
          password. <AppLink href="/sign-in">Back to sign in</AppLink>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={FORM_CARD_CLASS}
    >
      <h1 className="text-lg font-semibold">Forgot Password</h1>
      <p className="text-sm text-muted">
        Enter your email and we&apos;ll send you a link to reset your
        password.
      </p>
      <TextField value={email} onChange={setEmail} type="email" isRequired>
        <Label>Email</Label>
        <Input placeholder="you@example.com" className="bg-surface" />
      </TextField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth isDisabled={pending}>
        Send Reset Link
      </Button>
      <p className="text-sm text-muted">
        Remembered your password? <AppLink href="/sign-in">Sign in</AppLink>
      </p>
    </form>
  );
}
