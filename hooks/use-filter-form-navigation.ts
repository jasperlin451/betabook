"use client";

import { useState } from "react";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";
import { useReportNavigationPending } from "@/components/navigation-pending";

/** Shared by every filter form that auto-navigates on each field change
 * (climb search, area search, the area page, the user sends list): name/
 * areaName text state, the rest-of-filter state, the debounced navigation
 * combining them via `buildHref`, and a reset back to defaults. Callers
 * that don't have an area-name field (the area page) just don't wire
 * `areaName`/`setAreaName` into their form.
 *
 * The URL owns the filter: local state exists so typing is instant, but a
 * URL change this form didn't cause (back/forward, a sort control's own
 * replace) re-seeds it from the incoming props, and navigation only fires
 * when the built href differs from the current URL's canonical form — so
 * mounting and no-op edits leave the URL untouched. */
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

  // The canonical href for the URL this render's props were parsed from —
  // the URL side of useDebouncedReplace's comparison, and the values adopted
  // below when the URL changes underneath the form.
  const currentHref = buildHref(initialFilter, initialName, initialAreaName);
  const { isPending, urlChangedExternally } = useDebouncedReplace(
    buildHref(filter, name, areaName),
    currentHref,
  );

  // Back/forward (or a sort control's replace) changes the URL — and with it
  // the server-filtered results — without this form's involvement: adopt the
  // incoming values so the controls match what the results now show, and so
  // the debounce doesn't later overwrite the restored URL with stale state.
  // Only *external* changes re-seed (our own navigations round-trip with
  // urlChangedExternally false), and re-seeding sets values on the mounted
  // inputs rather than remounting them — which is also why callers must not
  // key the form on the filter: a remount would yank focus right as the
  // debounce lands. (Render-phase state adjustment, per React's "storing
  // information from previous renders".)
  if (urlChangedExternally) {
    setName(initialName);
    setAreaName(initialAreaName);
    setFilter(initialFilter);
  }

  useReportNavigationPending(isPending);

  function reset() {
    setName("");
    setAreaName("");
    setFilter(defaultFilter);
  }

  return { name, setName, areaName, setAreaName, filter, setFilter, reset, isPending };
}
