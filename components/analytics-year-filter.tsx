"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { choicePillClass } from "@/components/ui/choice-pill";
import { EYEBROW_CLASS } from "@/components/ui/eyebrow";

/** Matches the app's multi-select discipline pills. Empty selection means All. */
export function AnalyticsYearFilter({
  years,
  selected,
  onChange,
}: {
  years: readonly number[];
  selected: readonly number[];
  onChange: (years: number[]) => void;
}) {
  const options = [
    { label: "All", year: null },
    ...years.map((year) => ({ label: String(year), year })),
  ];
  return (
    <fieldset className="min-w-0">
      <legend className={`${EYEBROW_CLASS} mb-2`}>Years</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ label, year }) => {
          const pressed = year == null ? selected.length === 0 : selected.includes(year);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={pressed}
              className={`${choicePillClass(pressed, "bg-accent text-accent-foreground")} min-h-9`}
              onClick={() =>
                onChange(
                  year == null
                    ? []
                    : pressed
                      ? selected.filter((value) => value !== year)
                      : [...selected, year].sort((a, b) => a - b),
                )
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Keep rapid toggles responsive while the server refreshes all chart data. */
export function AnalyticsYearNavigation({
  years,
  selected,
}: {
  years: number[];
  selected: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [optimistic, setOptimistic] = useOptimistic(selected);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <AnalyticsYearFilter
        years={years}
        selected={optimistic}
        onChange={(next) => {
          startTransition(() => {
            setOptimistic(next);
            const query = new URLSearchParams(search);
            query.delete("period");
            query.delete("year");
            query.delete("pyramid");
            if (next.length) query.set("years", next.join(","));
            else query.delete("years");
            router.push(`${pathname}?${query}`, { scroll: false });
          });
        }}
      />
      <p role="status" className="sr-only">
        {pending ? "Updating charts…" : ""}
      </p>
    </div>
  );
}
