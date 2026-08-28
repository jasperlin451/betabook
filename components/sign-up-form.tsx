"use client";

import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { AppLink } from "@/components/ui/app-link";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [done, setDone] = useState(false);

  const passwordMismatch = submitAttempted && password !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitAttempted(true);
    if (password !== confirmPassword) return;
    setPending(true);
    authClient.signUp.email(
      { name, email, password, callbackURL: "/sign-in" },
      {
        onSuccess: () => setDone(true),
        onError: (ctx) => setError(ctx.error.message ?? "Sign up failed"),
        onResponse: () => setPending(false),
      },
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-muted">
          We sent a verification link to {email}. Verify your address, then{" "}
          <AppLink href="/sign-in">sign in</AppLink>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <h1 className="text-lg font-semibold">Sign Up</h1>
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
        Already have an account? <AppLink href="/sign-in">Sign in</AppLink>
      </p>
    </form>
  );
}
