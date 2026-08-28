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
  // its own when a nav link is clicked (including via AuthNav's nested
  // "Create" dropdown, which navigates programmatically) — close it
  // explicitly whenever the route changes instead of trying to catch every
  // click.
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
                  <NavLink href="/">Search</NavLink>
                  <AuthNav direction="col" />
                </nav>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer.Root>
    </>
  );
}
