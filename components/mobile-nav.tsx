"use client";

import { Button, useOverlayState } from "@heroui/react";
import { Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { useDeferredComponent } from "@/hooks/use-deferred-component";
import { useMounted } from "@/hooks/use-mounted";
import { authClient } from "@/lib/auth-client";

/** Module-level so its identity is stable across renders — the preload hook
 * keys its effect on the loader. */
const loadDrawer = () => import("@/components/mobile-nav-drawer").then((m) => m.MobileNavDrawer);

export function MobileNav() {
  const state = useOverlayState();
  const { close, open, setOpen } = state;
  const pathname = usePathname();
  const mounted = useMounted();
  const { data: session, isPending } = authClient.useSession();
  const { Component: MobileNavDrawer, load } = useDeferredComponent(loadDrawer);
  const showAccountAvatar = mounted && !isPending && session != null;

  // Pulls the drawer in on the way to opening, for a tap that beats the idle
  // preload. Ordinarily already resolved, so this is a no-op.
  const openMenu = useCallback(() => {
    load();
    open();
  }, [load, open]);

  // Root layout persists across navigations, so the drawer won't close on
  // its own when a nav link is clicked. The links below close it on press —
  // a route-change effect alone never fires for a tap on a link to the page
  // you're already on, leaving the drawer stuck open. The effect stays as a
  // backstop for navigations that don't go through these links (e.g.
  // programmatic ones from nested menus).
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        className="md:hidden"
        aria-label="Open menu"
        onPress={openMenu}
      >
        {showAccountAvatar ? (
          <UserAvatar name={session.user.name} image={session.user.image} size="sm" />
        ) : (
          <MenuIcon className="size-5" />
        )}
      </Button>
      {MobileNavDrawer && (
        <MobileNavDrawer isOpen={state.isOpen} onOpenChange={setOpen} onClose={close} />
      )}
    </>
  );
}
