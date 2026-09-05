import { notFound, redirect } from "next/navigation";

import { findProductTour, productTourPath } from "@/lib/product-tour-navigation";

export default async function TutorialStart({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await params;
  const tour = findProductTour(tourId);
  if (!tour) notFound();
  redirect(productTourPath(tour.id));
}
