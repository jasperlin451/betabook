"use client";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- The named horizontal scroll region supports keyboard navigation. */

import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { ClimbingCalendar } from "@/components/climbing-calendar";

/** One full-width calendar per slide; arrows and native scrolling share the same position. */
export function AnalyticsCalendar({
  years,
  countsByDay,
  hue,
  unit,
}: {
  years: number[];
  countsByDay: Record<string, number>;
  hue: string;
  unit: "send" | "session";
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const active = Math.min(index, years.length - 1);
  const go = (next: number) => {
    const element = viewport.current;
    if (!element || next < 0 || next >= years.length) return;
    element.scrollTo({ left: next * element.clientWidth, behavior: "auto" });
    setIndex(next);
  };
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        {years.length > 1 && (
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            aria-label="Older calendar year"
            isDisabled={active === 0}
            onPress={() => go(active - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
        )}
        <span
          aria-label="Displayed calendar year"
          aria-live="polite"
          className="text-sm font-medium tabular-nums"
        >
          {years[active]}
        </span>
        {years.length > 1 && (
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            aria-label="Newer calendar year"
            isDisabled={active === years.length - 1}
            onPress={() => go(active + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
      <div
        ref={viewport}
        role="region"
        aria-label="Calendar years"
        tabIndex={0}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-panel focus-visible:status-focused"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (element.clientWidth) setIndex(Math.round(element.scrollLeft / element.clientWidth));
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            go(active + (event.key === "ArrowLeft" ? -1 : 1));
          }
        }}
      >
        {years.map((year, position) => (
          <section
            key={year}
            aria-label={`Calendar ${year}`}
            aria-hidden={position !== active}
            className="relative w-full min-w-0 shrink-0 snap-start pb-2"
          >
            <ClimbingCalendar countsByDay={countsByDay} year={year} hue={hue} unit={unit} />
          </section>
        ))}
      </div>
    </div>
  );
}
