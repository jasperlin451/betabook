"use client";

import { useId, useState } from "react";
import { Button, Input, Label, Link, TextField } from "@heroui/react";
import { FormError } from "@/components/ui/form-error";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const mismatchErrorId = useId();
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
    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }
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
      <div className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6">
        <h1 className="text-lg font-semibold">Password reset</h1>
        <p className="text-sm text-muted">
          Your password has been reset. <Link href="/sign-in">Sign in</Link>{" "}
          with your new password.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <h1 className="text-lg font-semibold">Reset Password</h1>
      <TextField
        value={newPassword}
        onChange={setNewPassword}
        type="password"
        isRequired
      >
        <Label>New Password</Label>
        <Input className="bg-surface" />
      </TextField>
      <TextField
        value={confirmPassword}
        onChange={setConfirmPassword}
        type="password"
        isRequired
        isInvalid={passwordMismatch}
        aria-describedby={passwordMismatch ? mismatchErrorId : undefined}
      >
        <Label>Confirm New Password</Label>
        <Input className="bg-surface" />
      </TextField>
      {passwordMismatch && (
        <FormError id={mismatchErrorId}>Passwords do not match.</FormError>
      )}
      <FormError>{error}</FormError>
      <Button type="submit" fullWidth isDisabled={pending}>
        Reset Password
      </Button>
    </form>
  );
}
