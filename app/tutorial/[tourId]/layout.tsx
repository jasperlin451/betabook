import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { TourExperience } from "@/components/product-tours/tour-experience";
import { findProductTour, productTourPath } from "@/lib/product-tour-navigation";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = { title: "Product tour", robots: { index: false } };

export default async function TutorialLayout({
  params,
  children,
}: {
  params: Promise<{ tourId: string }>;
  children: ReactNode;
}) {
  const { tourId } = await params;
  const tour = findProductTour(tourId);
  if (!tour) notFound();
  const session = await getSession();
  if (!session) redirect(signInUrl(productTourPath(tour.id)));
  return (
    <TourExperience userId={session.user.id} tour={tour}>
      {children}
    </TourExperience>
  );
}
