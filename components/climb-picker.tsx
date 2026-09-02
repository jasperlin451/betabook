"use client";

import { useState } from "react";
import clsx from "clsx";
import { AppLink } from "@/components/ui/app-link";
import { AreaSearchField } from "@/components/area-search-field";
import { DisciplineChips } from "@/components/discipline-chips";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FIELD_CLASS } from "@/components/ui/field";
import { Grade } from "@/components/ui/grade";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useClimbSearch } from "@/hooks/use-climb-search";
import { formatCount } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import type { AreaBreadcrumbs, ClimbWithAreaName, Discipline } from "@/db/queries";

/** Where a result sits, as plain text — these rows are buttons that pick a
 * climb, so the linked <AreaBreadcrumb> every other list uses can't go inside
 * one. Same root-first reading, no navigation. */
function areaPath(climb: ClimbWithAreaName, areaBreadcrumbs: AreaBreadcrumbs): string {
  return [...(areaBreadcrumbs[climb.areaId] ?? []).map((a) => a.name), climb.areaName].join(" / ");
}

function ClimbRow({
  climb,
  path,
  sendCount,
  sent,
  pickable,
  onPick,
}: {
  climb: ClimbWithAreaName;
  path: string;
  sendCount: number;
  sent: boolean;
  /** False while these rows answer a superseded query — see ClimbPicker. */
  pickable: boolean;
  onPick: () => void;
}) {
  const detail = (
    <>
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm text-foreground">{climb.name}</span>
        <span className="block truncate text-xs text-muted">{path}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-muted sm:inline">
          {formatCount(sendCount, "ascent")}
        </span>
        <DisciplineChip type={climb.type} />
        <Grade>{formatGrade(climb.type, climb.grade)}</Grade>
      </span>
    </>
  );

  // Listed but not pickable: createSend refuses a second send for the same
  // climb, and a filtered-out row reads as a failed search rather than an
  // answer to "did I log this one?".
  if (sent) {
    return (
      <div
        aria-disabled
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 opacity-60"
      >
        {detail}
        <span className="shrink-0 text-xs font-medium text-success-soft-foreground">Logged</span>
      </div>
    );
  }

  // Not a button at all while stale: nothing to click beats a click that
  // binds the wrong climb.
  if (!pickable) {
    return (
      <div aria-disabled className="flex w-full items-center justify-between gap-3 px-3 py-2.5">
        {detail}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary/60 focus-visible:status-focused"
    >
      {detail}
    </button>
  );
}

/** Seeds for the new-climb form (see app/climbs/new). The discipline only
 * carries when one chip is selected — two or three describe a search, not a
 * climb, and picking one of them for the user would be a guess. */
function newClimbParams(
  name: string,
  areaName: string,
  disciplines: Discipline[],
): string {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (areaName.trim()) params.set("areaName", areaName.trim());
  if (disciplines.length === 1) params.set("type", disciplines[0]);
  return params.toString();
}

/** The total is what tells you a search is too broad to scroll, so past the
 * first page it says so outright rather than leaving "load more" as the only
 * hint that there's more behind it. */
function resultSummary(matchCount: number, loaded: number): string {
  const matches = formatCount(matchCount, "match", "matches");
  if (matchCount <= loaded) return matches;
  return `${matches} — showing the first ${loaded}. Narrow by area if yours isn't here.`;
}

/** Binds the climb a send is written against, where the surrounding page
 * isn't about one. A paged result list rather than the `RouteSearchField`
 * typeahead the filters use: a popover's five suggestions have no way past
 * them, and free text isn't an option when the value has to resolve to one
 * specific route. Hence the area field (narrows, matching ancestors), the
 * match total (says when a search is too broad), and "load more". */
export function ClimbPicker({
  onPick,
  sentClimbIds,
  initialName = "",
  initialAreaName = "",
}: {
  /** `context` is what the result list knew about the row beyond the climb
   * itself — its ancestor breadcrumbs and ascent count — for callers that
   * keep the pick around as a described climb (the import wizard) rather
   * than moving straight on to a form. */
  onPick: (
    climb: ClimbWithAreaName,
    context: { ancestors: { id: number; name: string }[]; sendCount: number },
  ) => void;
  /** Every climb id the viewer has already logged, when known — those rows
   * are marked and inert instead of failing on submit. */
  sentClimbIds?: Set<number>;
  /** Seeds for the search fields, where the caller already knows roughly
   * what's being looked for (a CSV row's climb and area names). */
  initialName?: string;
  initialAreaName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [areaName, setAreaName] = useState(initialAreaName);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const { pages, matchCount, status, loadingMore, loadMoreFailed, loadMore } = useClimbSearch({
    name,
    areaName,
    disciplines,
  });

  // Whether the rows on screen answer the query on screen.
  const current = status === "answered";

  const message = {
    idle: "Pick a discipline, or search by route or area name.",
    searching: "Searching…",
    failed: "Search failed — edit the search to try again.",
    answered: pages ? resultSummary(matchCount, pages.climbs.length) : "",
  }[status];

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky against the drawer body's own scroll (see .drawer__body) — a
        * search box that scrolls away is gone exactly when the list is long
        * enough to need narrowing.
        *
        * Pinned a few px ABOVE top-0, with the same amount padded back on:
        * .drawer__body carries 3px of padding (room for focus rings), and a
        * scroll container clips at its padding box, not its content box — so
        * at top-0 rows stay visible scrolling through that strip above the
        * header. Overshooting covers it; the extra is background, not text. */}
      <div className="sticky -top-1 z-10 flex flex-col gap-3 bg-overlay pt-1 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Which climb?</Eyebrow>
          {/* Discipline first, and the same chips the list toolbars use: it's
            * the cheapest cut available — one tap drops a name search by
            * roughly two thirds — and it's the one thing you always know
            * about a climb you just did, even when you're unsure of the
            * spelling. Narrows on its own too, with no text at all. */}
          <DisciplineChips value={disciplines} onChange={setDisciplines} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Plain text, not RouteSearchField: the list below is already the
            * suggestion surface, and a popover would cover it. Bare input, no
            * TextField wrapper — HeroUI wires its label to its own <Input>,
            * not to a raw one, so the name has to come from aria-label. */}
          <input
            autoFocus
            aria-label="Route name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route name…"
            // search-combo-input for the magnifier, so this reads as the same
            // kind of control as the area combobox beside it.
            className={`${FIELD_CLASS} search-combo-input w-full`}
          />
          <AreaSearchField
            value={areaName}
            onChange={setAreaName}
            onSelect={(area) => setAreaName(area.name)}
            ariaLabel="Narrow by area"
            placeholder="In area (optional)"
            emptyMessage="No matching areas — the text still narrows by area name."
            fullWidth
          />
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted">
          {message}
        </p>
      </div>

      {status === "answered" && pages?.climbs.length === 0 && (
        <EmptyState
          message="No climbs match that search."
          cta={
            // A send needs a climb to hang off, so an unlisted route is a
            // dead end here without this. The search that just failed seeds
            // the form, since it's already a description of the climb.
            <AppLink href={`/climbs/new?${newClimbParams(name, areaName, disciplines)}`} className="text-sm">
              Add the climb
            </AppLink>
          }
        />
      )}

      {pages != null && pages.climbs.length > 0 && (
        // Until the new query is answered these rows describe the old one, so
        // they go dim and inert: picking one would write a send against a
        // climb the search no longer shows.
        <div className={clsx("flex flex-col gap-3", !current && "opacity-50")}>
          <div className="flex flex-col divide-y divide-separator">
            {pages.climbs.map((climb) => (
              <ClimbRow
                key={climb.id}
                climb={climb}
                path={areaPath(climb, pages.areaBreadcrumbs)}
                sendCount={pages.sendStats[climb.id]?.sendCount ?? 0}
                sent={sentClimbIds?.has(climb.id) ?? false}
                pickable={current}
                onPick={() =>
                  onPick(climb, {
                    ancestors: pages.areaBreadcrumbs[climb.areaId] ?? [],
                    sendCount: pages.sendStats[climb.id]?.sendCount ?? 0,
                  })
                }
              />
            ))}
          </div>
          {current && pages.hasNextPage && (
            <LoadMoreButton onPress={loadMore} loading={loadingMore} failed={loadMoreFailed} />
          )}
        </div>
      )}
    </div>
  );
}
