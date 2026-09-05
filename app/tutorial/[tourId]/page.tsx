import { notFound, redirect } from "next/navigation";

import { findProductTour, productTourPath } from "@/lib/product-tour-navigation";

export default async function TutorialStart({
  params,
  searchParams,
}: {
  params: Promise<{ tourId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { tourId } = await params;
  const tour = findProductTour(tourId);
  if (!tour) notFound();
  const { from } = await searchParams;
  redirect(productTourPath(tour.id, undefined, typeof from === "string" ? from : undefined));
}
