import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { UserSendList, UserSendsFilterPanel } from "@/components/user-send-list";
import { StatStrip } from "@/components/ui/stat-strip";
import { getAreaBreadcrumbs, getSendsForUserPage, getUser, getUserSendsSummary } from "@/db/queries";
import { getDb } from "@/db/client";
import { parseUserSendsFilter } from "@/lib/user-sends-filter";
import { initAuth } from "@/lib/auth";

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

  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });

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

      {/* Three regions with independent mobile/desktop placement — a plain
       * two-slot side-by-side layout can't express "filter leads on mobile,
       * but stats trail on mobile while both share the desktop sidebar" —
       * so the stats card renders twice (cheap, pure) and each copy is
       * shown/hidden per breakpoint via Tailwind's responsive display. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-1 flex flex-col gap-6 lg:order-2 lg:w-72 lg:shrink-0">
          {summary.sendCount > 0 && <UserSendsFilterPanel userId={id} filter={filter} />}
          <div className="hidden lg:block">
            <StatStrip cards={statCards} />
          </div>
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

        <div className="order-3 lg:hidden">
          <StatStrip cards={statCards} />
        </div>
      </div>
    </div>
  );
}
