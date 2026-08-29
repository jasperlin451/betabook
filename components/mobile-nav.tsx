"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button, Drawer, useOverlayState } from "@heroui/react";
import { Menu as MenuIcon } from "lucide-react";
import { AuthNav } from "@/components/auth-nav";
import { NavLink } from "@/components/nav-link";

export function MobileNav() {
  const state = useOverlayState();
  const pathname = usePathname();

  // Root layout persists across navigations, so the drawer won't close on
  // its own when a nav link is clicked. The links below close it on press —
  // a route-change effect alone never fires for a tap on a link to the page
  // you're already on, leaving the drawer stuck open. The effect stays as a
  // backstop for navigations that don't go through these links (e.g.
  // programmatic ones from nested menus).
  useEffect(() => {
    state.close();
  }, [pathname]);

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        className="md:hidden"
        aria-label="Open menu"
        onPress={state.open}
      >
        <MenuIcon className="size-5" />
      </Button>
      <Drawer.Root state={state}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.Header>
                <Drawer.Heading>Menu</Drawer.Heading>
                <Drawer.CloseTrigger />
              </Drawer.Header>
              <Drawer.Body>
                <nav aria-label="Primary" className="flex flex-col items-start gap-4 text-sm">
                  <NavLink href="/" onClick={state.close}>
                    Search
                  </NavLink>
                  <AuthNav direction="col" onNavigate={state.close} />
                </nav>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer.Root>
    </>
  );
}
