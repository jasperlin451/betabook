"use client";

import { Button } from "@heroui/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSignOut() {
    setError(null);
    setPending(true);
    void authClient.signOut({
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
      <Button
        variant="outline"
        fullWidth
        className="gap-2"
        onPress={handleSignOut}
        isDisabled={pending}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
