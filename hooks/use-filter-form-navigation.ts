"use client";

import { useState } from "react";

import { useReportNavigationPending } from "@/components/navigation-pending";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";

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
  /** The list's current sort: passed through to `buildHref` so a filter
   * change preserves it — except right after `reset()`, when `defaultSort`
   * is passed instead, so Reset Filters restores the default sort too.
   * Every sorted surface (climb search, the area page, user sends) wires
   * both; a surface with no sort at all (area search) omits them and its
   * `buildHref` ignores the last argument. */
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
  // navigation itself landing. A sort-control click racing the debounce
  // clears it too, but only once that click's own navigation round-trips
  // and updates the prop; if the pending reset lands after that, the reset
  // still wins the sort. Narrow window, inherent to two uncoordinated
  // writers of the same URL.
  const [sortOverride, setSortOverride] = useState<Sort | null>(null);
  const [prevSort, setPrevSort] = useState(sort);
  if (prevSort !== sort) {
    // Render-time "adjust state when a prop changes" (per the React docs) —
    // clearing in an effect instead would let the pre-clear render's stale
    // href reach the debounce timer.
    setPrevSort(sort);
    setSortOverride(null);
  }

  // The canonical href for the URL this render's props were parsed from —
  // the URL side of useDebouncedReplace's comparison, and the values adopted
  // below when the URL changes underneath the form. Uses the `sort` prop,
  // not the override: the prop is what the current URL actually carries.
  const currentHref = buildHref(initialFilter, initialName, initialAreaName, sort);
  const { isPending, urlChangedExternally } = useDebouncedReplace(
    buildHref(filter, name, areaName, sortOverride ?? sort),
    currentHref,
  );

  // Back/forward changes the URL — and with it the server-filtered results —
  // without this form's involvement: adopt the incoming values so the
  // controls match what the results now show, and so the debounce doesn't
  // later overwrite the restored URL with stale state. Only *external*
  // changes re-seed (our own navigations round-trip with
  // urlChangedExternally false), and re-seeding sets values on the mounted
  // inputs rather than remounting them — which is also why callers must not
  // key the form on the filter: a remount would yank focus right as the
  // debounce lands. (Render-phase state adjustment, per React's "storing
  // information from previous renders".)
  //
  // A sort-only external change (the sort control's own replace) is the
  // exception: the form holds no sort field, so there is nothing to adopt —
  // and re-seeding would discard an edit still sitting in the debounce
  // window. Skipping it keeps the edit; the pending navigation then fires
  // with the new sort via the refreshed `sort` prop. Sort-insensitivity is
  // detected by comparing hrefs built with a pinned sort.
  const fingerprint = buildHref(initialFilter, initialName, initialAreaName, defaultSort);
  const [prevFingerprint, setPrevFingerprint] = useState(fingerprint);
  const nonSortValuesChanged = fingerprint !== prevFingerprint;
  if (nonSortValuesChanged) setPrevFingerprint(fingerprint);
  if (urlChangedExternally && nonSortValuesChanged) {
    setName(initialName);
    setAreaName(initialAreaName);
    setFilter(initialFilter);
  }

  useReportNavigationPending(isPending);

  function reset() {
    setName("");
    setAreaName("");
    setFilter(defaultFilter);
    if (defaultSort !== undefined) setSortOverride(defaultSort);
  }

  return { name, setName, areaName, setAreaName, filter, setFilter, reset, isPending };
}
