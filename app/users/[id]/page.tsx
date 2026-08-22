import { notFound } from "next/navigation";
import { UserSendList } from "@/components/user-send-list";
import { PageWithStats } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { getAreaBreadcrumbs, getSendsForUserPage, getUser, getUserSendsSummary } from "@/db/queries";
import { getDb } from "@/db/client";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";

type UserPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UserPage({ params, searchParams }: UserPageProps) {
  const { id } = await params;
  const filter = parseUserSendsFilter(await searchParams);

  const db = await getDb();
  const user = await getUser(db, id);
  if (!user) notFound();

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{user.name}</h1>

      <PageWithStats
        stats={
          <StatStrip
            cards={[
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
            ]}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Sends</h2>
          <UserSendList
            key={JSON.stringify(filter)}
            userId={id}
            filter={filter}
            initialSends={firstPage.sends}
            initialHasMore={firstPage.hasMore}
            initialAreaBreadcrumbs={areaBreadcrumbs}
            hasAnySends={summary.sendCount > 0}
          />
        </div>
      </PageWithStats>
    </div>
  );
}
