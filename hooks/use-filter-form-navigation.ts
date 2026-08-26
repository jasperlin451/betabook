"use client";

import { useState } from "react";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";

/** Shared by every filter form that auto-navigates on each field change
 * (climb search, the area page, the user sends list): name/areaName text
 * state, the rest-of-filter state, the debounced navigation combining them
 * via `buildHref`, and a reset back to defaults. Callers that don't have an
 * area-name field (the area page) just don't wire `areaName`/`setAreaName`
 * into their form. */
export function useFilterFormNavigation<T>({
  initialFilter,
  initialName = "",
  initialAreaName = "",
  defaultFilter,
  buildHref,
}: {
  initialFilter: T;
  initialName?: string;
  initialAreaName?: string;
  defaultFilter: T;
  buildHref: (filter: T, name: string, areaName: string) => string;
}) {
  const [name, setName] = useState(initialName);
  const [areaName, setAreaName] = useState(initialAreaName);
  const [filter, setFilter] = useState(initialFilter);

  useDebouncedReplace(buildHref(filter, name, areaName));

  function reset() {
    setName("");
    setAreaName("");
    setFilter(defaultFilter);
  }

  return { name, setName, areaName, setAreaName, filter, setFilter, reset };
}
