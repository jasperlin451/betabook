import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { TourExperience } from "@/components/product-tours/tour-experience";
import { findProductTour } from "@/lib/product-tour-navigation";
import { getSession } from "@/lib/session";

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
  // The page has the step and search params needed for the exact sign-in continuation.
  if (!session) return children;
  return (
    <TourExperience userId={session.user.id} tour={tour}>
      {children}
    </TourExperience>
  );
}
