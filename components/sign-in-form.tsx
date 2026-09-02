"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppLink } from "@/components/ui/app-link";
import { FORM_CARD_CLASS } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/typography";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_SIGNED_IN_PATH, safeNextPath, signInUrl, signUpUrl } from "@/lib/sign-in-redirect";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  // The page already validates the param, but re-validate the prop here so
  // the form can never be handed an off-origin destination.
  const nextPath = safeNextPath(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The address a 403 unverified-login error came back for. The resend
  // affordance is bound to this, not to whatever is currently typed in the
  // email field.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const attemptedEmail = email;
    setError(null);
    setUnverifiedEmail(null);
    setResent(false);
    setResendError(null);
    setPending(true);
    void authClient.signIn.email(
      { email: attemptedEmail, password },
      {
        onSuccess: () => router.push(nextPath ?? DEFAULT_SIGNED_IN_PATH),
        onError: (ctx) => {
          if (ctx.error.status === 403) {
            setUnverifiedEmail(attemptedEmail);
          } else {
            setError(ctx.error.message ?? "Sign in failed");
          }
        },
        onResponse: () => setPending(false),
      },
    );
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    // The unverified prompt refers to the attempted address; once the field
    // is edited it no longer applies.
    if (unverifiedEmail !== null) {
      setUnverifiedEmail(null);
      setResent(false);
      setResendError(null);
    }
  }

  function resendVerification() {
    if (!unverifiedEmail) return;
    setResent(false);
    setResendError(null);
    setResendPending(true);
    void authClient.sendVerificationEmail(
      // After the verification link is clicked, land back on this sign-in
      // URL, continuation included.
      { email: unverifiedEmail, callbackURL: signInUrl(nextPath) },
      {
        onSuccess: () => setResent(true),
        onError: (ctx) =>
          setResendError(ctx.error.message ?? "Could not resend the verification email"),
        onResponse: () => setResendPending(false),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className={FORM_CARD_CLASS}>
      <PageTitle className="text-2xl">Sign in</PageTitle>
      <TextField value={email} onChange={handleEmailChange} type="email" isRequired>
        <Label>Email</Label>
        <Input placeholder="you@example.com" />
      </TextField>
      <TextField value={password} onChange={setPassword} type="password" isRequired>
        <Label>Password</Label>
        <Input />
      </TextField>
      <AppLink href="/forgot-password" className="text-sm text-muted">
        Forgot password?
      </AppLink>
      {error && <p className="text-sm text-danger">{error}</p>}
      {unverifiedEmail !== null && (
        <div className="flex flex-col gap-2 text-sm text-danger">
          <p>Please verify your email address before signing in.</p>
          <Button variant="ghost" onPress={resendVerification} isDisabled={resent || resendPending}>
            {resent ? "Verification email sent" : "Resend verification email"}
          </Button>
          {resendError && <p>{resendError}</p>}
        </div>
      )}
      <Button type="submit" fullWidth isDisabled={pending}>
        Sign in
      </Button>
      <p className="text-sm text-muted">
        Don&apos;t have an account? <AppLink href={signUpUrl(nextPath)}>Sign up</AppLink>
      </p>
    </form>
  );
}
