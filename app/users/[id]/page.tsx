import { buttonVariants } from "@heroui/react";
import { ChartColumnIncreasing } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LogSendButton } from "@/components/log-send-button";
import { NavigationPendingProvider } from "@/components/navigation-pending";
import { AppLink } from "@/components/ui/app-link";
import { DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SidebarLayout } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageTitle, SectionHeading } from "@/components/ui/typography";
import { UserSendList, UserSendsFilterToolbar } from "@/components/user-send-list";
import { getDb } from "@/db/client";
import {
  getAreaBreadcrumbs,
  getSendsForUserPage,
  getUser,
  getUserSentClimbIds,
  getUserSendsSummary,
} from "@/db/queries";
import { formatCount } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import type { SearchParamsRecord } from "@/lib/search-params";
import { getSession } from "@/lib/session";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";

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

  // Profiles carry a real name and full ascent history — kept out of search
  // indexes; links on the page are still followed.
  return { title: user.name, robots: { index: false } };
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

  const isOwnProfile = session?.user.id === id;

  const [summary, firstPage, sentClimbIds] = await Promise.all([
    // The stats card reflects the user's whole history — computed via small
    // aggregate queries, independent of the list's current filter/page.
    getUserSendsSummary(db, id),
    // A user's send count can run into the thousands, so the list itself is
    // always fetched a page at a time, never in full (see UserSendList).
    getSendsForUserPage(db, id, filter, 0),
    // The whole set, not just this page's — the picker searches the entire
    // database, so a climb logged years ago must still come back marked.
    // Only the owner can log, so only the owner's visit pays for it.
    isOwnProfile ? getUserSentClimbIds(db, id) : Promise.resolve(undefined),
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
      {/* Stacked until sm for the same reason as the area header: two
       * labelled controls can't share a phone's width with the name. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>Climber</Eyebrow>
          <PageTitle>{user.name}</PageTitle>
          <span className="mt-1 text-sm text-muted">Active since {memberSinceYear}</span>
        </div>
        {/* Owner only: a send is always the signed-in viewer's own, so on
         * someone else's profile the button would write a row that doesn't
         * belong to the page it sits on. Analytics steps back to outline
         * where it isn't the header's only action. */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {isOwnProfile && <LogSendButton sentClimbIds={sentClimbIds} />}
          <AppLink
            href={`/users/${id}/analytics`}
            className={`${buttonVariants({ variant: isOwnProfile ? "outline" : undefined })} gap-2`}
          >
            <ChartColumnIncreasing className="size-5" />
            Analytics
          </AppLink>
        </div>
      </div>

      {/* The stats sidebar leads on mobile and sits right of the list on
       * desktop — a single render of the stats card, so the headline stats
       * aren't buried below the infinite send list on mobile and don't appear
       * twice in the accessibility tree. Filters sit in a toolbar directly
       * above the rows they narrow, the same shape the area page uses over
       * its climb table.
       *
       * The provider links the toolbar's in-flight navigation to the send
       * list it re-fetches, which dims while pending. */}
      <NavigationPendingProvider>
        <SidebarLayout sidebar={<StatStrip cards={statCards} />}>
          <div className="flex flex-col gap-3">
            <SectionHeading>Sends</SectionHeading>
            {summary.sendCount > 0 && <UserSendsFilterToolbar userId={id} filter={filter} />}
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
        </SidebarLayout>
      </NavigationPendingProvider>
    </div>
  );
}
