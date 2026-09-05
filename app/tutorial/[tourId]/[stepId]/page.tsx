import { notFound, redirect } from "next/navigation";

import {
  findProductTour,
  parseProductTourNavigation,
  type ProductTourSearchParams,
  PRODUCT_TOUR_STEPS,
  productTourPath,
} from "@/lib/product-tour-navigation";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export default async function TutorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ tourId: string; stepId: string }>;
  searchParams: Promise<ProductTourSearchParams>;
}) {
  const { tourId, stepId } = await params;
  const tour = findProductTour(tourId);
  if (!tour || !PRODUCT_TOUR_STEPS[tour.id].some((step) => step.id === stepId)) notFound();
  if (!(await getSession())) {
    const navigation = parseProductTourNavigation(await searchParams);
    redirect(signInUrl(productTourPath(tour.id, { ...navigation, stepId })));
  }
  return null;
}
