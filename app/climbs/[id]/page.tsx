import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { LogSendButton } from "@/components/log-send-button";
import { ClimbActionsMenu } from "@/components/climb-actions-menu";
import { ClimbSendList } from "@/components/climb-send-list";
import { GradeWithTrend } from "@/components/climb-list";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageWithStats } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { RatingStars } from "@/components/ui/rating-stars";
import { averageRating, ascentStyleBreakdown, averageSuggestedGrade } from "@/lib/send-stats";
import { getAncestors, getArea, getClimb, getSendsForClimb, getUserSendForClimb } from "@/db/queries";
import { formatGrade } from "@/lib/grades";
import { missingDescriptionMessage } from "@/lib/descriptions";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/session";

type ClimbPageProps = {
  params: Promise<{ id: string }>;
};

// Shared between generateMetadata and the page — see the identical pattern in
// app/areas/[id]/page.tsx for why the whole id -> climb lookup is memoized
// rather than the (db, id)-keyed query helper.
const getClimbById = cache(async (id: number) => {
  const db = await getDb();
  return getClimb(db, id);
});

export async function generateMetadata({ params }: ClimbPageProps): Promise<Metadata> {
  const { id } = await params;
  const climbId = Number(id);
  if (!Number.isInteger(climbId)) notFound();

  const climb = await getClimbById(climbId);
  if (!climb) notFound();

  return {
    title:
      climb.grade == null
        ? climb.name
        : `${climb.name} (${formatGrade(climb.type, climb.grade)})`,
  };
}

export default async function ClimbPage({ params }: ClimbPageProps) {
  const { id } = await params;
  const climbId = Number(id);

  if (!Number.isInteger(climbId)) notFound();

  // Grouped by dependency tier so independent fetches overlap instead of
  // waterfalling: the db handle, the climb row, and the session don't depend
  // on each other; the sends queries need only the climb; and the ancestor
  // chain needs the area row's parentId.
  const [db, climb, session] = await Promise.all([getDb(), getClimbById(climbId), getSession()]);
  if (!climb) notFound();

  const [area, userSend, climbSends] = await Promise.all([
    getArea(db, climb.areaId),
    session ? getUserSendForClimb(db, session.user.id, climb.id).then((s) => s ?? null) : null,
    getSendsForClimb(db, climb.id),
  ]);
  if (!area) notFound();

  const ancestors = await getAncestors(db, area);

  const rating = averageRating(climbSends);
  const avgSuggestedGrade = averageSuggestedGrade(climbSends);
  const breakdown = ascentStyleBreakdown(climbSends);
  const loggedBreakdown = Object.entries(breakdown).filter(([, count]) => count > 0);

  return (
    <div className="flex flex-col gap-6">
      <Eyebrow icon={MapPin}>
        <AreaBreadcrumbs ancestors={[...ancestors, area]} current={climb} />
      </Eyebrow>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{climb.name}</h1>
          <p className="text-muted mt-1 capitalize">
            {climb.type} &middot; {formatGrade(climb.type, climb.grade)}
          </p>
          <p className="text-muted mt-1">
            {climb.description || missingDescriptionMessage("climb")}
          </p>
        </div>
        {session && <ClimbActionsMenu climb={climb} />}
      </div>

      <PageWithStats
        statsPosition="before"
        stats={
          <div className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
            <StatStrip
              cards={[
                {
                  key: "summary",
                  stats: [
                    {
                      label: "Community rating",
                      value: <RatingStars rating={rating} precision="decimal" />,
                    },
                    { label: "Logged ascents", value: climbSends.length },
                    ...(avgSuggestedGrade != null
                      ? [
                          {
                            label: "Suggested grade",
                            value: (
                              <GradeWithTrend
                                type={climb.type}
                                grade={climb.grade}
                                avgSuggestedGrade={avgSuggestedGrade}
                              />
                            ),
                          },
                        ]
                      : []),
                  ],
                },
                ...(loggedBreakdown.length > 0
                  ? [
                      {
                        key: "breakdown",
                        heading: (
                          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                            Ascent breakdown
                          </span>
                        ),
                        stats: loggedBreakdown.map(([type, count]) => ({
                          label: type,
                          value: count,
                        })),
                      },
                    ]
                  : []),
              ]}
            />
            {session && !userSend && <LogSendButton climb={climb} />}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Sends</h2>
          <ClimbSendList sends={climbSends} climb={climb} currentUserId={session?.user.id} />
        </div>
      </PageWithStats>
    </div>
  );
}
