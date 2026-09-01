"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSignOut() {
    setError(null);
    setPending(true);
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
        onError: (ctx) => setError(ctx.error.message ?? "Sign out failed"),
        onResponse: () => setPending(false),
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onPress={handleSignOut} isDisabled={pending}>
        Sign out
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
