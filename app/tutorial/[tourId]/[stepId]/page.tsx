import { notFound } from "next/navigation";

import { findProductTour, PRODUCT_TOUR_STEPS } from "@/lib/product-tour-navigation";

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ tourId: string; stepId: string }>;
}) {
  const { tourId, stepId } = await params;
  const tour = findProductTour(tourId);
  if (!tour || !PRODUCT_TOUR_STEPS[tour.id].some((step) => step.id === stepId)) notFound();
  return null;
}
