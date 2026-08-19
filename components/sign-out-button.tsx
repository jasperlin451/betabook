"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  }

  return <Button onPress={handleSignOut}>Sign Out</Button>;
}
