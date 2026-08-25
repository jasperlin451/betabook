"use client";

import { useRouter } from "next/navigation";
import { Button, Dropdown, Link } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useMounted } from "@/hooks/use-mounted";

export function AuthNav() {
  // better-auth's session store can resolve from a client-side cache before
  // the first paint, while the server always renders the pending state —
  // gating on `mounted` keeps the SSR and first client render identical so
  // hydration doesn't mismatch; the real state applies right after mount.
  const mounted = useMounted();
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (!mounted || isPending) {
    return <span className="text-muted">&nbsp;</span>;
  }

  if (session) {
    return (
      <span className="flex items-center gap-6">
        <Dropdown>
          <Dropdown.Trigger>
            <Button variant="ghost" size="sm" className="dark:[--button-fg:var(--accent)]">
              Create
              <ChevronDown className="size-4" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu onAction={(key) => key === "climb" && router.push("/climbs/new")}>
              <Dropdown.Item id="climb">Climb</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <Link href={`/users/${session.user.id}`}>My sends</Link>
        <Link href="/account">Account</Link>
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
