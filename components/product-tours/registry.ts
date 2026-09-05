import type { ProductTourStep } from "@/components/product-tours/types";
import type { ProductTourId } from "@/lib/product-tour";

/** Each feature's content is downloaded only when its tour is opened. */
export const PRODUCT_TOUR_LOADERS: Record<
  ProductTourId,
  () => Promise<readonly ProductTourStep[]>
> = {
  journal: () =>
    import("@/components/product-tours/journal-tour").then((module) => module.journalTourSteps),
};
