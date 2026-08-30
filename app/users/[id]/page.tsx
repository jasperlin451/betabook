import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { UserSendList, UserSendsFilterPanel } from "@/components/user-send-list";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SidebarLayout } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageTitle } from "@/components/ui/typography";
import { getAreaBreadcrumbs, getSendsForUserPage, getUser, getUserSendsSummary } from "@/db/queries";
import { getDb } from "@/db/client";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";
import { formatCount } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { getSession } from "@/lib/session";
import type { SearchParamsRecord } from "@/lib/search-params";

type UserPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

// Shared between generateMetadata and the page — see the identical pattern in
// app/areas/[id]/page.tsx for why the whole id -> user lookup is memoized
// rather than the (db, id)-keyed query helper.
const getUserById = cache(async (id: string) => {
  const db = await getDb();
  return getUser(db, id);
});

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  return { title: user.name };
}

export default async function UserPage({ params, searchParams }: UserPageProps) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const filter = parseUserSendsFilter(search);

  // Grouped by dependency tier so independent fetches overlap instead of
  // waterfalling: the db handle, the user row, and the session don't depend
  // on each other; the summary and the first page of sends need only the
  // user id; and the breadcrumbs need that first page's area ids.
  const [db, user, session] = await Promise.all([getDb(), getUserById(id), getSession()]);
  if (!user) notFound();

  const [summary, firstPage] = await Promise.all([
    // The stats card reflects the user's whole history — computed via small
    // aggregate queries, independent of the list's current filter/page.
    getUserSendsSummary(db, id),
    // A user's send count can run into the thousands, so the list itself is
    // always fetched a page at a time, never in full (see UserSendList).
    getSendsForUserPage(db, id, filter, 0),
  ]);
  const memberSinceYear = new Date(user.createdAt).getFullYear();

  const areaBreadcrumbs = await getAreaBreadcrumbs(
    db,
    firstPage.sends.map((send) => send.areaId),
  );

  const statCards = [
    {
      key: "profile",
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
            heading: <Eyebrow>Log at a glance</Eyebrow>,
            stats: [
              { label: "Latest send", value: formatDate(summary.latestSendDate) },
              ...(summary.mostLoggedDiscipline
                ? [
                    {
                      label: "Most logged",
                      value: `${DISCIPLINE_LABELS[summary.mostLoggedDiscipline.type]} · ${formatCount(summary.mostLoggedDiscipline.count, "send")}`,
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Eyebrow>Climber</Eyebrow>
        <PageTitle>{user.name}</PageTitle>
        <span className="mt-1 text-sm text-muted">
          Active since {memberSinceYear}
        </span>
      </div>

      {/* The sidebar (filters + stats) leads on mobile and sits right of the
       * list on desktop — a single render of the stats card, so the headline
       * stats aren't buried below the infinite send list on mobile and don't
       * appear twice in the accessibility tree.
       *
       * The provider links the filter panel's in-flight navigation to the
       * send list it re-fetches, which dims while pending. */}
      <NavigationPendingProvider>
        <SidebarLayout
          sidebar={
            <>
              {summary.sendCount > 0 && (
                <CollapsibleSection title="Filters" breakpoint="lg" showTitleOnDesktop={false}>
                  <UserSendsFilterPanel userId={id} filter={filter} />
                </CollapsibleSection>
              )}
              <StatStrip cards={statCards} />
            </>
          }
        >
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
        </SidebarLayout>
      </NavigationPendingProvider>
    </div>
  );
}
