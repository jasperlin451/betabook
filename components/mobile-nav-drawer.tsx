"use client";

import { Button, Drawer } from "@heroui/react";
import { Smartphone } from "lucide-react";

import { AuthNav } from "@/components/auth-nav";
import { openMobileAppHelper } from "@/components/mobile-app-helper";
import { useMounted } from "@/hooks/use-mounted";
import { isStandaloneDisplay } from "@/lib/mobile-detection";

/** The drawer itself, split from its trigger so `Drawer` — and the react-aria
 * overlay code behind it — isn't in the bundle every route loads. The nav
 * preloads this on idle, so it is in memory before the menu button can be
 * tapped. Open state stays with the trigger, which has to work before this
 * module arrives. */
export function MobileNavDrawer({
  isOpen,
  onOpenChange,
  onClose,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}) {
  const mounted = useMounted();
  const isStandalone = mounted && isStandaloneDisplay();

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.Header>
            <Drawer.Heading>Menu</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            {/* AuthNav's signed-in link set includes an explicit Search
             * entry (to "/?mode=climb") alongside the header magnifier and
             * ⌘K palette — a deliberate product decision to make search
             * reachable from the nav itself, not just those affordances. */}
            <nav aria-label="Primary" className="flex flex-col items-start gap-4 text-sm">
              <AuthNav direction="col" onNavigate={onClose} />
              {!isStandalone && (
                <div className="mt-2 w-full border-t border-separator pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2.5 text-muted hover:text-foreground"
                    onPress={() => {
                      onClose();
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
  );
}
