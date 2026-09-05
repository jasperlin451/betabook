import { getCloudflareContext } from "@opennextjs/cloudflare";

import { JournalFilterToolbar, JournalTimeline } from "@/components/journal";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { ProductTour } from "@/components/product-tour";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SidebarLayout } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { SectionHeading } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import {
  getAreaBreadcrumbs,
  getClimb,
  getJournalCounts,
  getJournalPage,
  getProductTourState,
} from "@/db/queries";
import type { JournalOwner } from "@/db/queries";
import { calendarMonth } from "@/lib/format-date";
import type { JournalFilter } from "@/lib/journal-filter";

export async function JournalView({
  owner,
  viewerId,
  filter,
}: {
  owner: JournalOwner;
  viewerId: string | null;
  filter: JournalFilter;
}) {
  const db = await getDb();
  const isOwner = viewerId === owner.id;
  const { cf } = await getCloudflareContext({ async: true });
  const month = calendarMonth(new Date(), cf?.timezone ?? "UTC");

  const [counts, firstPage, filteredClimb, tourState] = await Promise.all([
    getJournalCounts(db, owner, viewerId, month),
    getJournalPage(db, owner, viewerId, filter),
    filter.climbId === null ? Promise.resolve(null) : getClimb(db, filter.climbId),
    isOwner ? getProductTourState(db, owner.id) : Promise.resolve(null),
  ]);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    firstPage.entries.flatMap((entry) => (entry.areaId == null ? [] : [entry.areaId])),
  );

  const statCards = [
    ...(counts.entriesThisMonth > 0
      ? [
          {
            key: "month",
            heading: <Eyebrow>This month</Eyebrow>,
            stats: [
              { label: "Days out", value: counts.daysThisMonth },
              { label: "Entries", value: counts.entriesThisMonth },
              { label: "Sent sessions", value: counts.sentThisMonth },
            ],
          },
        ]
      : []),
    {
      key: "all-time",
      heading: <Eyebrow>All time</Eyebrow>,
      stats: [
        { label: "Days out", value: counts.days },
        { label: "Sessions", value: counts.sessions },
        { label: "Training", value: counts.training },
      ],
    },
  ];

  return (
    <NavigationPendingProvider>
      {tourState && <ProductTour initialState={tourState} />}
      <SidebarLayout sidebar={<StatStrip cards={statCards} />}>
        <div className="flex flex-col gap-3">
          <SectionHeading>Journal</SectionHeading>
          {counts.entries > 0 && (
            <JournalFilterToolbar
              userId={owner.id}
              filter={filter}
              climbName={filteredClimb?.name ?? null}
            />
          )}
          <JournalTimeline
            key={JSON.stringify(filter)}
            userId={owner.id}
            filter={filter}
            initialEntries={firstPage.entries}
            initialHasMore={firstPage.hasMore}
            initialAreaBreadcrumbs={areaBreadcrumbs}
            isOwner={isOwner}
            hasAnyEntries={counts.entries > 0}
          />
        </div>
      </SidebarLayout>
    </NavigationPendingProvider>
  );
}
