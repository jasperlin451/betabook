import { getCloudflareContext } from "@opennextjs/cloudflare";

import { GoalPanel } from "@/components/goals/goal-panel";
import { JournalStats } from "@/components/goals/journal-stats";
import { JournalFilterToolbar, JournalTimeline } from "@/components/journal";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { ProductTour } from "@/components/product-tour";
import { Eyebrow } from "@/components/ui/eyebrow";
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
import { getGoalOverview, getNextGoalGrades } from "@/db/queries/goals";
import { getUserHashtags } from "@/db/queries/hashtag-filter";
import { getJournalFilterFriends } from "@/db/queries/journal-companions";
import type { JournalFilter } from "@/lib/filters/journal-filter";
import { calendarMonth } from "@/lib/format-date";
import { goalToday } from "@/lib/goals";

export async function JournalView({
  ownerId,
  viewerId,
  filter: requestedFilter,
}: {
  ownerId: string;
  viewerId: string | null;
  filter: JournalFilter;
}) {
  const db = await getDb();
  const isOwner = viewerId === ownerId;
  const filter = isOwner ? requestedFilter : { ...requestedFilter, friendIds: [] };
  const { cf } = await getCloudflareContext({ async: true });
  const timezone = cf?.timezone ?? "UTC";
  const today = goalToday(timezone);
  const month = calendarMonth(new Date(), cf?.timezone ?? "UTC");

  const [overview, nextGrades, counts, firstPage, filteredClimb, tourState, tags, friends] =
    await Promise.all([
      getGoalOverview(db, ownerId, viewerId),
      isOwner ? getNextGoalGrades(db, ownerId, ownerId) : Promise.resolve({}),
      getJournalCounts(db, ownerId, viewerId, month),
      getJournalPage(db, ownerId, viewerId, filter),
      filter.climbId === null ? Promise.resolve(null) : getClimb(db, filter.climbId),
      isOwner ? getProductTourState(db, ownerId) : Promise.resolve(null),
      getUserHashtags(db, ownerId, viewerId, false, true),
      isOwner ? getJournalFilterFriends(db, ownerId) : Promise.resolve([]),
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
      <div className="flex flex-col gap-3">
        <SectionHeading>Journal</SectionHeading>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <GoalPanel
              key={JSON.stringify([overview.active, overview.completed])}
              ownerId={ownerId}
              isOwner={isOwner}
              initialActive={overview.active}
              initialCompleted={overview.completed}
              timezone={timezone}
              today={today}
              nextGrades={nextGrades}
            />
            <JournalStats>
              <StatStrip cards={statCards} />
            </JournalStats>
            {counts.entries > 0 && (
              <JournalFilterToolbar
                userId={ownerId}
                tags={tags}
                isOwner={isOwner}
                friends={friends}
                filter={filter}
                climbName={filteredClimb?.name ?? null}
              />
            )}
            <JournalTimeline
              key={JSON.stringify(filter)}
              userId={ownerId}
              filter={filter}
              initialEntries={firstPage.entries}
              initialHasMore={firstPage.hasMore}
              initialAreaBreadcrumbs={areaBreadcrumbs}
              isOwner={isOwner}
              hasAnyEntries={counts.entries > 0}
            />
          </div>
          <aside className="hidden lg:block" aria-label="Journal stats">
            <StatStrip cards={statCards} />
          </aside>
        </div>
      </div>
    </NavigationPendingProvider>
  );
}
