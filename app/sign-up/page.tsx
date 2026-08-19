"use client";

import { useState } from "react";
import { Link } from "@heroui/react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
          <Link href="/sign-in">sign in</Link>.
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
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth isDisabled={pending}>
        Sign Up
      </Button>
      <p className="text-sm text-muted">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
