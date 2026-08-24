import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { LogSendButton } from "@/components/log-send-button";
import { ClimbActionsMenu } from "@/components/climb-actions-menu";
import { ClimbSendList } from "@/components/climb-send-list";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageWithStats } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { RatingStars } from "@/components/ui/rating-stars";
import { averageRating, ascentStyleBreakdown, suggestedGradeRange } from "@/lib/send-stats";
import { getAncestors, getArea, getClimb, getSendsForClimb, getUserSendForClimb } from "@/db/queries";
import { formatGrade } from "@/lib/grades";
import { missingDescriptionMessage } from "@/lib/descriptions";
import { getDb } from "@/db/client";
import { initAuth } from "@/lib/auth";

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

  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const userSend = session
    ? ((await getUserSendForClimb(db, session.user.id, climb.id)) ?? null)
    : null;
  const climbSends = await getSendsForClimb(db, climb.id);

  const rating = averageRating(climbSends);
  const gradeRange = suggestedGradeRange(climbSends, climb.type);
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
          <div className="flex flex-col gap-4">
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
                    ...(gradeRange
                      ? [{ label: "Suggested grade", value: `${gradeRange.min}–${gradeRange.max}` }]
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
