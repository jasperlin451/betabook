"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Link, TextField } from "@heroui/react";
import { FormError } from "@/components/ui/form-error";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setPending(true);
    authClient.signIn.email(
      { email, password },
      {
        onSuccess: () => router.push("/account"),
        onError: (ctx) => {
          if (ctx.error.status === 403) {
            setUnverified(true);
          } else {
            setError(ctx.error.message ?? "Sign in failed");
          }
        },
        onResponse: () => setPending(false),
      },
    );
  }

  function resendVerification() {
    setResent(false);
    authClient.sendVerificationEmail(
      { email, callbackURL: "/sign-in" },
      { onSuccess: () => setResent(true) },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <h1 className="text-lg font-semibold">Sign In</h1>
      <TextField value={email} onChange={setEmail} type="email" isRequired>
        <Label>Email</Label>
        <Input placeholder="you@example.com" className="bg-surface" />
      </TextField>
      <TextField value={password} onChange={setPassword} type="password" isRequired>
        <Label>Password</Label>
        <Input className="bg-surface" />
      </TextField>
      <Link href="/forgot-password" className="text-sm text-muted">
        Forgot password?
      </Link>
      <FormError>{error}</FormError>
      {unverified && (
        <div className="flex flex-col gap-2">
          <FormError>Please verify your email address before signing in.</FormError>
          <Button variant="ghost" onPress={resendVerification} isDisabled={resent}>
            {resent ? "Verification email sent" : "Resend verification email"}
          </Button>
        </div>
      )}
      <Button type="submit" fullWidth isDisabled={pending}>
        Sign In
      </Button>
      <p className="text-sm text-muted">
        Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
      </p>
    </form>
  );
}
