"use client";

import { PageTitle } from "@/components/ui/typography";
import { FORM_CARD_CLASS } from "@/components/ui/card";
import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { AppLink } from "@/components/ui/app-link";

// The page only renders this form when a token is present (missing/invalid
// links get a dead-end state there), so the prop is required. The token can
// still expire between page load and submit — resetPassword's onError
// surfaces that.
export function ResetPasswordForm({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [done, setDone] = useState(false);

  const passwordMismatch = submitAttempted && newPassword !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitAttempted(true);
    if (newPassword !== confirmPassword) return;
    setPending(true);
    authClient.resetPassword(
      { newPassword, token },
      {
        onSuccess: () => setDone(true),
        onError: (ctx) => setError(ctx.error.message ?? "Reset failed"),
        onResponse: () => setPending(false),
      },
    );
  }

  if (done) {
    return (
      <div className={FORM_CARD_CLASS}>
        <PageTitle className="text-2xl">Password reset</PageTitle>
        <p className="text-sm text-muted">
          Your password has been reset. <AppLink href="/sign-in">Sign in</AppLink>{" "}
          with your new password.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={FORM_CARD_CLASS}
    >
      <PageTitle className="text-2xl">Reset password</PageTitle>
      <TextField
        value={newPassword}
        onChange={setNewPassword}
        type="password"
        isRequired
      >
        <Label>New password</Label>
        <Input />
      </TextField>
      <TextField
        value={confirmPassword}
        onChange={setConfirmPassword}
        type="password"
        isRequired
      >
        <Label>Confirm new password</Label>
        <Input />
      </TextField>
      {passwordMismatch && (
        <p className="text-sm text-danger">Passwords do not match.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth isDisabled={pending}>
        Reset password
      </Button>
    </form>
  );
}
