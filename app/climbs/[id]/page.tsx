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
import {
  getAncestors,
  getArea,
  getClimb,
  getClimbSendSummary,
  getSendsForClimb,
  getUserSendForClimb,
} from "@/db/queries";
import { formatGrade } from "@/lib/grades";
import { missingDescriptionMessage } from "@/lib/descriptions";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/session";

type ClimbPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClimbPage({ params }: ClimbPageProps) {
  const { id } = await params;
  const climbId = Number(id);

  if (!Number.isInteger(climbId)) notFound();

  const db = await getDb();
  const climb = await getClimb(db, climbId);

  if (!climb) notFound();

  const area = await getArea(db, climb.areaId);
  if (!area) notFound();

  const ancestors = await getAncestors(db, area);

  const session = await getSession();
  // Stats come from whole-history aggregates and the list from a paginated
  // query — a popular climb's full send history never ships in the RSC
  // payload (ClimbSendList "load more"-fetches the rest on demand).
  const [userSend, sendsPage, summary] = await Promise.all([
    session ? getUserSendForClimb(db, session.user.id, climb.id) : Promise.resolve(null),
    getSendsForClimb(db, climb.id),
    getClimbSendSummary(db, climb.id),
  ]);

  const loggedBreakdown = Object.entries(summary.styleBreakdown).filter(([, count]) => count > 0);

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
                      value: <RatingStars rating={summary.avgRating} precision="decimal" />,
                    },
                    { label: "Logged ascents", value: summary.sendCount },
                    ...(summary.avgSuggestedGrade != null
                      ? [
                          {
                            label: "Suggested grade",
                            value: (
                              <GradeWithTrend
                                type={climb.type}
                                grade={climb.grade}
                                avgSuggestedGrade={summary.avgSuggestedGrade}
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
          <ClimbSendList
            climb={climb}
            initialSends={sendsPage.sends}
            initialHasMore={sendsPage.hasMore}
            currentUserId={session?.user.id}
          />
        </div>
      </PageWithStats>
    </div>
  );
}
