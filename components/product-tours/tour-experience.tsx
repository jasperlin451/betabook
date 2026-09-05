"use client";

import { Button } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { saveProductTourStatus } from "@/actions";
import { PRODUCT_TOUR_LOADERS } from "@/components/product-tours/registry";
import { TourOverlay } from "@/components/product-tours/tour-overlay";
import type { ProductTourPage } from "@/components/product-tours/types";
import { AppLink } from "@/components/ui/app-link";
import { GENERIC_ERROR_MESSAGE } from "@/lib/action-result";
import { suspendMobileHelper } from "@/lib/mobile-helper-suspension";
import type { ProductTourDefinition } from "@/lib/product-tour";
import {
  PRODUCT_TOUR_STEPS,
  productTourExitPath,
  productTourPath,
} from "@/lib/product-tour-navigation";

export function TourExperience({
  userId,
  tour,
  children,
}: {
  userId: string;
  tour: ProductTourDefinition;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const from = useSearchParams().get("from") ?? "journal";
  const steps = PRODUCT_TOUR_STEPS[tour.id];
  const index = steps.findIndex((step) => pathname.endsWith(`/${step.id}`));
  const [Page, setPage] = useState<ProductTourPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const page = useRef<HTMLDivElement>(null);
  const exitPath = productTourExitPath(userId, from);
  const exit = useCallback(() => router.replace(exitPath), [router, exitPath]);
  const href = useCallback((id: string) => productTourPath(tour.id, id, from), [tour.id, from]);

  useEffect(() => suspendMobileHelper(), []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loaded = await PRODUCT_TOUR_LOADERS[tour.id]();
        if (active) setPage(() => loaded);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [tour, attempt]);

  function finish() {
    startTransition(async () => {
      try {
        const result = await saveProductTourStatus(tour.id, tour.version, "completed");
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace(`/users/${userId}/journal`);
      } catch {
        setError(GENERIC_ERROR_MESSAGE);
      }
    });
  }

  if (index < 0) return children;
  return (
    <div className="flex flex-col gap-6 pb-[60vh]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm">
        <span className="font-medium">Demo account · Product tour</span>
        <AppLink href={exitPath} className="text-foreground underline">
          Exit tour
        </AppLink>
      </div>
      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>Couldn't load the tour.</p>
          <Button
            onPress={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : Page ? (
        <>
          <div ref={page}>
            <Page key={steps[index].section} section={steps[index].section} href={href} />
          </div>
          <TourOverlay
            steps={steps}
            index={index}
            page={page}
            href={href}
            exit={exit}
            finish={finish}
            pending={pending}
            error={error}
          />
        </>
      ) : (
        <p role="status">Loading your tour…</p>
      )}
      {children}
    </div>
  );
}
