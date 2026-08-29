import { notFound } from "next/navigation";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { UserSendList, UserSendsFilterPanel } from "@/components/user-send-list";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { StatStrip } from "@/components/ui/stat-strip";
import { getAreaBreadcrumbs, getSendsForUserPage, getUser, getUserSendsSummary } from "@/db/queries";
import { getDb } from "@/db/client";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";
import { getSession } from "@/lib/session";
import type { SearchParamsRecord } from "@/lib/search-params";

type UserPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export default async function UserPage({ params, searchParams }: UserPageProps) {
  const { id } = await params;
  const filter = parseUserSendsFilter(await searchParams);

  const db = await getDb();
  const user = await getUser(db, id);
  if (!user) notFound();

  const session = await getSession();

  // The stats card reflects the user's whole history — computed via small
  // aggregate queries, independent of the list's current filter/page.
  const summary = await getUserSendsSummary(db, id);
  const memberSinceYear = new Date(user.createdAt).getFullYear();

  // A user's send count can run into the thousands, so the list itself is
  // always fetched a page at a time, never in full (see UserSendList).
  const firstPage = await getSendsForUserPage(db, id, filter, 0);
  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    firstPage.sends.map((send) => send.areaId),
  );

  const statCards = [
    {
      key: "profile",
      heading: <div className="text-xs text-muted">Active since {memberSinceYear}</div>,
      stats: [
        { label: "Sends", value: summary.sendCount },
        { label: "Areas", value: summary.areaCount },
        { label: "Peak grade", value: summary.peakGrade ?? "—" },
      ],
    },
    ...(summary.sendCount > 0
      ? [
          {
            key: "glance",
            heading: (
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                Log at a glance
              </span>
            ),
            stats: [
              { label: "Latest send", value: summary.latestSendDate ?? "Unknown" },
              ...(summary.mostLoggedDiscipline
                ? [
                    {
                      label: "Most logged",
                      value: `${summary.mostLoggedDiscipline.type} / ${summary.mostLoggedDiscipline.count}`,
                    },
                  ]
                : []),
              { label: "Highest route", value: summary.peakGrade ?? "—" },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{user.name}</h1>

      {/* The sidebar (filters + stats) leads on mobile and sits right of the
       * list on desktop, via order-* — a single render of the stats card, so
       * the headline stats aren't buried below the infinite send list on
       * mobile and don't appear twice in the accessibility tree.
       *
       * The provider links the filter panel's in-flight navigation to the
       * send list it re-fetches, which dims while pending. */}
      <NavigationPendingProvider>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="order-1 flex flex-col gap-6 lg:order-2 lg:w-80 lg:shrink-0">
            {summary.sendCount > 0 && (
              <CollapsibleSection title="Filters" breakpoint="lg" showTitleOnDesktop={false}>
                <UserSendsFilterPanel userId={id} filter={filter} />
              </CollapsibleSection>
            )}
            <StatStrip cards={statCards} />
          </div>

          <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 lg:order-1">
            <UserSendList
              key={JSON.stringify(filter)}
              userId={id}
              filter={filter}
              initialSends={firstPage.sends}
              initialHasMore={firstPage.hasMore}
              initialAreaBreadcrumbs={areaBreadcrumbs}
              hasAnySends={summary.sendCount > 0}
              currentUserId={session?.user.id}
            />
          </div>
        </div>
      </NavigationPendingProvider>
    </div>
  );
}
