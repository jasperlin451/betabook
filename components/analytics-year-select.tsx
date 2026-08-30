"use client";

import { ListBox, Select } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
    <Select
      aria-label={label}
      selectedKey={selected == null ? ALL_KEY : String(selected)}
      onSelectionChange={(key) => navigate(String(key))}
    >
      <Select.Trigger className="w-28">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {allLabel != null && (
            <ListBox.Item key={ALL_KEY} id={ALL_KEY}>
              {allLabel}
            </ListBox.Item>
          )}
          {years.map((year) => (
            <ListBox.Item key={year} id={String(year)} textValue={String(year)}>
              {year}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
