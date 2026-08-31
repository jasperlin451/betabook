"use client";

import { PageTitle } from "@/components/ui/typography";
import { FORM_CARD_CLASS } from "@/components/ui/card";
import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { AppLink } from "@/components/ui/app-link";
import { safeNextPath, signInUrl } from "@/lib/sign-in-redirect";

export function SignUpForm({ next }: { next?: string }) {
  // The page already validates the param, but re-validate the prop here so
  // the form can never be handed an off-origin destination.
  const nextPath = safeNextPath(next);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const passwordMismatch = submitAttempted && password !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitAttempted(true);
    if (password !== confirmPassword) return;
    setPending(true);
    authClient.signUp.email(
      // The verification link lands back on sign-in, carrying the original
      // destination so the continuation survives sign-up → verify → sign-in.
      { name, email, password, callbackURL: signInUrl(nextPath) },
      {
        onSuccess: () => setDone(true),
        onError: (ctx) => setError(ctx.error.message ?? "Sign up failed"),
        onResponse: () => setPending(false),
      },
    );
  }

  // Bound to the just-registered address; same better-auth call (and the
  // same land-back-on-sign-in callback) as the sign-in form's resend.
  function resendVerification() {
    setResent(false);
    setResendError(null);
    setResendPending(true);
    authClient.sendVerificationEmail(
      { email, callbackURL: signInUrl(nextPath) },
      {
        onSuccess: () => setResent(true),
        onError: (ctx) =>
          setResendError(ctx.error.message ?? "Could not resend the verification email"),
        onResponse: () => setResendPending(false),
      },
    );
  }

  if (done) {
    return (
      <div className={FORM_CARD_CLASS}>
        <PageTitle className="text-2xl">Check your email</PageTitle>
        <p className="text-sm text-muted">
          We sent a verification link to {email}. Verify your address, then{" "}
          <AppLink href={signInUrl(nextPath)}>sign in</AppLink>.
        </p>
        <Button
          variant="ghost"
          onPress={resendVerification}
          isDisabled={resent || resendPending}
        >
          {resent ? "Verification email sent" : "Resend verification email"}
        </Button>
        {resendError && <p className="text-sm text-danger">{resendError}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={FORM_CARD_CLASS}
    >
      <PageTitle className="text-2xl">Sign Up</PageTitle>
      <TextField value={name} onChange={setName} isRequired>
        <Label>Name</Label>
        <Input placeholder="Your name" className="bg-surface" />
      </TextField>
      <TextField value={email} onChange={setEmail} type="email" isRequired>
        <Label>Email</Label>
        <Input placeholder="you@example.com" className="bg-surface" />
      </TextField>
      <TextField value={password} onChange={setPassword} type="password" isRequired>
        <Label>Password</Label>
        <Input className="bg-surface" />
      </TextField>
      <TextField
        value={confirmPassword}
        onChange={setConfirmPassword}
        type="password"
        isRequired
      >
        <Label>Confirm Password</Label>
        <Input className="bg-surface" />
      </TextField>
      {passwordMismatch && (
        <p className="text-sm text-danger">Passwords do not match.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth isDisabled={pending}>
        Sign Up
      </Button>
      <p className="text-sm text-muted">
        Already have an account? <AppLink href={signInUrl(nextPath)}>Sign in</AppLink>
      </p>
    </form>
  );
}
