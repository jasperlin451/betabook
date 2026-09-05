"use client";

import { Drawer } from "@heroui/react";
import type { UseOverlayStateReturn } from "@heroui/react";

import { ProductTourContent } from "@/components/product-tour-content";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import type { ProductTourDefinition } from "@/lib/product-tour";

export function ProductTourDrawer({
  userId,
  tour,
  state,
  onComplete,
}: {
  userId: string;
  tour: ProductTourDefinition;
  state: UseOverlayStateReturn;
  onComplete: () => void;
}) {
  return (
    <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <Drawer.Content>
        <Drawer.Dialog className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
          <Drawer.Header>
            <Drawer.Heading>{tour.name}</Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <ProductTourContent
            userId={userId}
            tour={tour}
            onComplete={onComplete}
            onClose={state.close}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
