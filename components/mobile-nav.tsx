"use client";

import { Button, Drawer, useOverlayState } from "@heroui/react";
import { Menu as MenuIcon, Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { AuthNav } from "@/components/auth-nav";
import { openMobileAppHelper } from "@/components/mobile-app-helper";
import { useMounted } from "@/hooks/use-mounted";
import { isStandaloneDisplay } from "@/lib/mobile-detection";

export function MobileNav() {
  const mounted = useMounted();
  const isStandalone = mounted && isStandaloneDisplay();
  const state = useOverlayState();
  const { close, open } = state;
  const pathname = usePathname();

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
        onPress={open}
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
                {/* No Search entry: every screen already carries a way into
                 * the palette — the header's magnifier, or the home page's
                 * own full-width entry, which stands the magnifier down
                 * (see SearchTrigger). The desktop nav dropped its Search
                 * link for the same reason — a menu row pointing at "/"
                 * just duplicates it one tap deeper. */}
                <nav aria-label="Primary" className="flex flex-col items-start gap-4 text-sm">
                  <AuthNav direction="col" onNavigate={close} />
                  {!isStandalone && (
                    <div className="mt-2 w-full border-t border-separator pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2.5 text-muted hover:text-foreground"
                        onPress={() => {
                          close();
                          openMobileAppHelper();
                        }}
                      >
                        <Smartphone className="size-4" />
                        <span>Add to Home Screen</span>
                      </Button>
                    </div>
                  )}
                </nav>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer.Root>
    </>
  );
}
