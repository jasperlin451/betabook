"use client";

import { Button, buttonVariants } from "@heroui/react";
import { ArrowLeft, X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

import { useTourTarget } from "@/components/product-tours/use-tour-target";
import { AppLink } from "@/components/ui/app-link";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/action-result";
import type { ProductTourStepDefinition } from "@/lib/product-tour-navigation";
import { positionTourCard } from "@/lib/product-tour-position";
import { signInUrl } from "@/lib/sign-in-redirect";

type TourOverlayProps = {
  steps: readonly ProductTourStepDefinition[];
  index: number;
  page: RefObject<HTMLDivElement | null>;
  href: (id: string) => string;
  exit: () => void;
  finish: () => void;
  pending: boolean;
  error: string | null;
};

export function TourOverlay({
  steps,
  index,
  page,
  href,
  exit,
  finish,
  pending,
  error,
}: TourOverlayProps) {
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const step = steps[index];
  const { rect, viewport, cardHeight } = useTourTarget(step.target, page, card);
  const position = positionTourCard(rect, viewport, cardHeight);
  const ready = viewport.width > 0;
  useEffect(() => {
    if (ready) heading.current?.focus({ preventScroll: true });
    if (menu.current) menu.current.open = false;
  }, [step.id, ready]);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !pending) {
        event.preventDefault();
        exit();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [exit, pending]);
  return (
    <>
      {rect && viewport.width > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        ref={card}
        role="region"
        aria-label="Product tour"
        className="fixed z-50 flex flex-col gap-3 overflow-y-auto rounded-xl border border-foreground/30 bg-surface p-4 text-foreground shadow-xl"
        style={{
          ...position,
          maxHeight: viewport.height ? Math.max(120, viewport.height - 24) : undefined,
          visibility: viewport.width ? "visible" : "hidden",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted">
            {index + 1} of {steps.length} · {step.section}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Exit tour"
            onPress={exit}
            isDisabled={pending}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
        <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
          {step.title}
        </h2>
        <p className="text-sm leading-relaxed">{step.description}</p>
        <div className="flex items-center justify-between gap-3">
          {index > 0 ? (
            <AppLink
              href={href(steps[index - 1].id)}
              aria-label={`Previous: ${steps[index - 1].title}`}
              className="flex items-center gap-1 text-sm text-foreground"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back
            </AppLink>
          ) : (
            <span />
          )}
          {index === steps.length - 1 ? (
            <Button onPress={finish} isDisabled={pending}>
              {pending ? "Finishing…" : "Finish tour"}
            </Button>
          ) : (
            <AppLink
              href={href(steps[index + 1].id)}
              className={buttonVariants()}
              aria-label={`Next: ${steps[index + 1].title}`}
            >
              Next
            </AppLink>
          )}
        </div>
        {error && (
          <div role="alert" className="flex flex-col gap-2 text-sm">
            <p className="text-danger">{error}</p>
            {error === SESSION_EXPIRED_MESSAGE ? (
              <AppLink href={signInUrl(href(step.id))}>Sign in to finish</AppLink>
            ) : (
              <p>Try finishing again.</p>
            )}
          </div>
        )}
        <details ref={menu} className="border-t border-border pt-2">
          <summary className="w-fit cursor-pointer rounded-full border border-foreground/30 bg-default px-3 py-2 text-xs font-medium focus-visible:status-focused">
            All tutorials
          </summary>
          <nav aria-label="Tutorial steps" className="mt-2 flex flex-col gap-1">
            {steps.map((entry, i) => (
              <AppLink
                key={entry.id}
                href={href(entry.id)}
                aria-current={entry.id === step.id ? "step" : undefined}
                className="rounded-md px-2 py-2 text-sm text-foreground hover:bg-surface-secondary"
              >
                {i + 1}. {entry.title}
              </AppLink>
            ))}
          </nav>
        </details>
      </div>
    </>
  );
}
