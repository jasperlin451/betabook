"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveProductTourStatus } from "@/actions";
import { PRODUCT_TOUR_QUICK_ACTIONS } from "@/components/product-tours/quick-actions";
import { cardClass } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHeading } from "@/components/ui/typography";
import { GENERIC_ERROR_MESSAGE } from "@/lib/action-result";
import {
  PRODUCT_TOURS,
  shouldOfferProductTour,
  type ProductTourState,
  type ProductTourDefinition,
} from "@/lib/product-tour";
import {
  getProductTourSteps,
  PRODUCT_TOUR_STEPS,
  productTourPath,
} from "@/lib/product-tour-navigation";

/** The owner invitation and Account replay catalog share the same registry. */
export function ProductTour({ initialState }: { initialState?: ProductTourState }) {
  return (
    <>
      {PRODUCT_TOURS.map((tour) => (
        <TourInvitation
          key={`${tour.id}:${tour.version}`}
          tour={tour}
          initialState={initialState}
        />
      ))}
    </>
  );
}

function TourInvitation({
  tour,
  initialState,
}: {
  tour: ProductTourDefinition;
  /** Omitted in Account, where replay is always available. */
  initialState?: ProductTourState;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const replay = initialState === undefined;
  const savedVersion =
    initialState?.progress.find((entry) => entry.tourId === tour.id)?.version ?? 0;
  const updates = savedVersion > 0;
  const steps = getProductTourSteps(PRODUCT_TOUR_STEPS[tour.id], tour.version, savedVersion);
  const offered =
    replay || (!hidden && steps.length > 0 && shouldOfferProductTour(tour, initialState.progress));
  const QuickAction = PRODUCT_TOUR_QUICK_ACTIONS[tour.id];

  function open() {
    router.push(productTourPath(tour.id, steps[0]?.id, replay ? "account" : "journal", updates));
  }

  function dismiss() {
    startTransition(async () => {
      try {
        const result = await saveProductTourStatus(tour.id, tour.version, "dismissed");
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setHidden(true);
      } catch {
        setError(GENERIC_ERROR_MESSAGE);
      }
    });
  }

  return (
    <>
      {offered &&
        (replay ? (
          <Button variant="outline" onPress={open} aria-label={`Replay product tour: ${tour.name}`}>
            Replay product tour{PRODUCT_TOURS.length > 1 ? `: ${tour.name}` : ""}
          </Button>
        ) : (
          <section aria-label={tour.name} className={`${cardClass("md")} flex flex-col gap-3`}>
            <Eyebrow>
              {updates || initialState.returning ? "What's new" : "Welcome to Betabook"}
            </Eyebrow>
            <SectionHeading>
              {updates ? tour.name : initialState.returning ? tour.returningTitle : tour.title}
            </SectionHeading>
            <p className="text-sm text-muted">
              {updates
                ? steps.map((step) => step.title).join(" · ")
                : initialState.returning
                  ? tour.returningDescription
                  : tour.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onPress={open} isDisabled={pending}>
                {updates ? "See what's new" : "Show me how"}
              </Button>
              {QuickAction && <QuickAction />}
              <Button variant="ghost" onPress={dismiss} isDisabled={pending}>
                {pending ? "Dismissing…" : "Dismiss"}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error} Try dismissing again.
              </p>
            )}
          </section>
        ))}
    </>
  );
}
