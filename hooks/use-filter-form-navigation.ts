"use client";

import { useState } from "react";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";

/** Shared by every filter form that auto-navigates on each field change
 * (climb search, the area page, the user sends list): name/areaName text
 * state, the rest-of-filter state, the debounced navigation combining them
 * via `buildHref`, and a reset back to defaults. Callers that don't have an
 * area-name field (the area page) just don't wire `areaName`/`setAreaName`
 * into their form. */
export function useFilterFormNavigation<T, Sort extends string = string>({
  initialFilter,
  initialName = "",
  initialAreaName = "",
  defaultFilter,
  sort,
  defaultSort,
  buildHref,
}: {
  initialFilter: T;
  initialName?: string;
  initialAreaName?: string;
  defaultFilter: T;
  /** The list's current sort, for surfaces whose sort control lives outside
   * this form (climb search, the area page): passed through to `buildHref`
   * so a filter change preserves it — except right after `reset()`, when
   * `defaultSort` is passed instead, so Reset Filters restores the default
   * sort too. Surfaces that carry sort inside the filter itself (user
   * sends) omit both, and `buildHref` just ignores its last argument. */
  sort?: Sort;
  defaultSort?: Sort;
  buildHref: (filter: T, name: string, areaName: string, sort: Sort | undefined) => string;
}) {
  const [name, setName] = useState(initialName);
  const [areaName, setAreaName] = useState(initialAreaName);
  const [filter, setFilter] = useState(initialFilter);
  // reset() can't reach into the sort control's state (it lives outside this
  // form, fed from the URL), so it sets this override instead, which stands
  // in for the `sort` prop until that prop next changes — normally the reset
  // navigation itself landing, but also a sort-control click racing the
  // debounce, whose fresher choice then wins.
  const [sortOverride, setSortOverride] = useState<Sort | null>(null);
  const [prevSort, setPrevSort] = useState(sort);
  if (prevSort !== sort) {
    // Render-time "adjust state when a prop changes" (per the React docs) —
    // clearing in an effect instead would let the pre-clear render's stale
    // href reach the debounce timer.
    setPrevSort(sort);
    setSortOverride(null);
  }

  useDebouncedReplace(buildHref(filter, name, areaName, sortOverride ?? sort));

  function reset() {
    setName("");
    setAreaName("");
    setFilter(defaultFilter);
    if (defaultSort !== undefined) setSortOverride(defaultSort);
  }

  return { name, setName, areaName, setAreaName, filter, setFilter, reset };
}
