import { ActionError } from "@/lib/action-result";

/** Add a new feature here; UI step loaders live in components/product-tours/registry.ts. */
export const PRODUCT_TOURS = [
  {
    id: "journal",
    version: 1,
    name: "Logging sessions and training",
    title: "Your climbing, beyond sends",
    description:
      "Record outdoor sessions, projects, and training. Start with a quick tour, or log what you did today.",
    returningTitle: "Logging now includes sessions and training",
    returningDescription:
      "Record days on a project, repeat ascents, and training alongside your sends. Take a quick look at the new logging flow.",
  },
] as const;

export type ProductTourId = (typeof PRODUCT_TOURS)[number]["id"];
export type ProductTourDefinition = (typeof PRODUCT_TOURS)[number];
export type ProductTourProgress = {
  tourId: string;
  version: number;
  status: "dismissed" | "completed";
};
export type ProductTourState = {
  returning: boolean;
  progress: ProductTourProgress[];
};

export function shouldOfferProductTour(
  tour: { id: string; version: number },
  progress: ProductTourProgress[],
): boolean {
  const saved = progress.find((entry) => entry.tourId === tour.id);
  return !saved || saved.version < tour.version;
}

export function validateProductTourUpdate(
  id: string,
  version: number,
  status: string,
): ProductTourProgress {
  const tour = PRODUCT_TOURS.find((entry) => entry.id === id);
  if (!tour || version !== tour.version) {
    throw new ActionError("This tour has changed. Reload the page and try again.");
  }
  if (status !== "dismissed" && status !== "completed") {
    throw new ActionError("Invalid product tour status");
  }
  return { tourId: tour.id, version: tour.version, status };
}
