"use client";

import { Button, Drawer } from "@heroui/react";
import { useEffect, useRef, useState, useTransition } from "react";

import { saveProductTourStatus } from "@/actions";
import { PRODUCT_TOUR_LOADERS } from "@/components/product-tours/registry";
import type { ProductTourStep } from "@/components/product-tours/types";
import { Eyebrow } from "@/components/ui/eyebrow";
import { GENERIC_ERROR_MESSAGE } from "@/lib/action-result";
import type { ProductTourDefinition } from "@/lib/product-tour";

export function ProductTourContent({
  userId,
  tour,
  onComplete,
  onClose,
}: {
  userId: string;
  tour: ProductTourDefinition;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<readonly ProductTourStep[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loaded = await PRODUCT_TOUR_LOADERS[tour.id]();
        if (active) setSteps(loaded);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [tour, attempt]);
  if (failed)
    return (
      <Drawer.Body role="alert" className="flex flex-col gap-3">
        <p>Couldn't load the tour.</p>
        <Button
          onPress={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        >
          Try again
        </Button>
      </Drawer.Body>
    );
  if (!steps) return <Drawer.Body role="status">Loading your tour…</Drawer.Body>;
  return (
    <TourSteps
      steps={steps}
      userId={userId}
      tour={tour}
      onComplete={onComplete}
      onClose={onClose}
    />
  );
}

function TourSteps({
  steps,
  userId,
  tour,
  onComplete,
  onClose,
}: {
  steps: readonly ProductTourStep[];
  userId: string;
  tour: ProductTourDefinition;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[index];
  const canFinish = step.canFinish || index === steps.length - 1;
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  function finish() {
    startTransition(async () => {
      try {
        const result = await saveProductTourStatus(tour.id, tour.version, "completed");
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onComplete();
      } catch {
        setError(GENERIC_ERROR_MESSAGE);
      }
    });
  }

  function navigate(id: string, additions?: Record<string, string>) {
    const next = steps.findIndex((entry) => entry.id === id);
    if (next < 0) return;
    if (additions) setValues((previous) => ({ ...previous, ...additions }));
    setIndex(next);
  }

  return (
    <>
      <Drawer.Body>
        <div className="flex flex-col gap-5 pb-2">
          <div className="flex flex-col gap-1">
            <Eyebrow>{step.eyebrow}</Eyebrow>
            <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
              {step.title}
            </h2>
          </div>
          <step.Content userId={userId} values={values} navigate={navigate} close={onClose} />
        </div>
      </Drawer.Body>
      {(step.navigation !== "custom" || canFinish) && (
        <Drawer.Footer className="shrink-0 flex-col items-stretch border-t border-border pt-3">
          <div className="flex gap-2">
            {step.navigation !== "custom" && index > 0 && (
              <Button
                className="h-auto min-h-10 flex-1 whitespace-normal sm:flex-none"
                variant="ghost"
                onPress={() => setIndex(index - 1)}
                isDisabled={pending}
              >
                Previous: {steps[index - 1].navigationLabel ?? steps[index - 1].title}
              </Button>
            )}
            {canFinish ? (
              <Button
                className="h-auto min-h-10 flex-1 whitespace-normal sm:flex-none"
                onPress={finish}
                isDisabled={pending}
              >
                {pending ? "Finishing…" : "Finish tour"}
              </Button>
            ) : (
              <Button
                className="h-auto min-h-10 flex-1 whitespace-normal sm:flex-none"
                onPress={() => setIndex(index + 1)}
              >
                Next: {steps[index + 1].navigationLabel ?? steps[index + 1].title}
              </Button>
            )}
          </div>
          {canFinish && (
            <p className="text-xs text-muted">You can replay this tour from Account at any time.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error} Try finishing again.
            </p>
          )}
        </Drawer.Footer>
      )}
    </>
  );
}
