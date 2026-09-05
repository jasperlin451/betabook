import { notFound, redirect } from "next/navigation";

import {
  findProductTour,
  productTourPath,
  parseProductTourNavigation,
  type ProductTourSearchParams,
} from "@/lib/product-tour-navigation";

export default async function TutorialStart({
  params,
  searchParams,
}: {
  params: Promise<{ tourId: string }>;
  searchParams: Promise<ProductTourSearchParams>;
}) {
  const { tourId } = await params;
  const tour = findProductTour(tourId);
  if (!tour) notFound();
  const navigation = parseProductTourNavigation(await searchParams);
  redirect(productTourPath(tour.id, navigation));
}
