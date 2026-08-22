import { notFound } from "next/navigation";
import { UserSendList } from "@/components/user-send-list";
import { PageWithStats } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { getArea, getNearestAncestors, getSendsForUser, getUser, summarizeUserSends } from "@/db/queries";
import { getDb } from "@/db/client";

type UserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;

  const db = await getDb();
  const user = await getUser(db, id);
  if (!user) notFound();

  const userSends = await getSendsForUser(db, id);
  const summary = summarizeUserSends(userSends);
  const memberSinceYear = new Date(user.createdAt).getFullYear();

  // Up to two ancestor areas per climb, for a breadcrumb next to each send —
  // fetched once per distinct area rather than once per send.
  const areaBreadcrumbs: Record<number, { id: number; name: string }[]> = {};
  await Promise.all(
    [...new Set(userSends.map((send) => send.areaId))].map(async (areaId) => {
      const area = await getArea(db, areaId);
      if (!area) return;
      const ancestors = await getNearestAncestors(db, area, 2);
      areaBreadcrumbs[areaId] = ancestors.map((a) => ({ id: a.id, name: a.name }));
    }),
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
          <UserSendList sends={userSends} areaBreadcrumbs={areaBreadcrumbs} />
        </div>
      </PageWithStats>
    </div>
  );
}
