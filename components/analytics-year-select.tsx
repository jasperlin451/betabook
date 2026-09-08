"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";

const ALL_KEY = "all";

/** Year picker for the analytics cards — a dropdown, since a long climbing
 * career can hold more years than a chip row fits. Navigates by rewriting
 * one URL param (no scroll reset), so every slice stays linkable. Pass
 * `allLabel` to offer an all-time option that clears the param. */
export function AnalyticsYearSelect({
  param,
  years,
  selected,
  allLabel,
  label,
}: {
  param: string;
  /** Years with sends, newest first. */
  years: number[];
  /** The active year, or null when the all-time option is active. */
  selected: number | null;
  allLabel?: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (key: string) => {
    const query = new URLSearchParams(searchParams);
    if (key === ALL_KEY) query.delete(param);
    else query.set(param, key);
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return (
    <OptionSelect
      ariaLabel={label}
      value={selected == null ? ALL_KEY : String(selected)}
      onChange={navigate}
      className={FIELD_WIDTH_CLASS.medium}
      options={[
        ...(allLabel == null ? [] : [{ value: ALL_KEY, label: allLabel }]),
        ...years.map((year) => ({ value: String(year), label: String(year) })),
      ]}
    />
  );
}
