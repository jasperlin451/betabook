import { notFound, redirect } from "next/navigation";

import {
  findProductTour,
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
  searchParams: Promise<{ from?: string | string[]; mode?: string | string[] }>;
}) {
  const { tourId, stepId } = await params;
  const tour = findProductTour(tourId);
  if (!tour || !PRODUCT_TOUR_STEPS[tour.id].some((step) => step.id === stepId)) notFound();
  if (!(await getSession())) {
    const { from, mode } = await searchParams;
    redirect(
      signInUrl(
        productTourPath(
          tour.id,
          stepId,
          typeof from === "string" ? from : undefined,
          mode === "updates",
        ),
      ),
    );
  }
  return null;
}
