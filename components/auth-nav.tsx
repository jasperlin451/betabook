"use client";

import { useRouter } from "next/navigation";
import { Link } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <span className="text-muted">&nbsp;</span>;
  }

  if (session) {
    return (
      <span className="flex items-center gap-4">
        <Link href="/account">{session.user.email}</Link>
        <button
          type="button"
          className="cursor-pointer text-sm text-muted hover:text-foreground"
          onClick={() =>
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/");
                  router.refresh();
                },
              },
            })
          }
        >
          Log Out
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-4">
      <Link href="/sign-in">Log In</Link>
      <Link href="/sign-up">Sign Up</Link>
    </span>
  );
}
