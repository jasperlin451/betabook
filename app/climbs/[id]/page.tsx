import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { LogSendButton } from "@/components/log-send-button";
import { EditSendButton } from "@/components/edit-send-button";
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
import { signInUrl } from "@/lib/sign-in-redirect";
import { AppLink } from "@/components/ui/app-link";

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

  // Stats come from whole-history aggregates and the list from a paginated
  // query — a popular climb's full send history never ships in the RSC
  // payload (ClimbSendList "load more"-fetches the rest on demand).
  const [area, userSend, sendsPage, summary] = await Promise.all([
    getArea(db, climb.areaId),
    session ? getUserSendForClimb(db, session.user.id, climb.id).then((s) => s ?? null) : null,
    getSendsForClimb(db, climb.id),
    getClimbSendSummary(db, climb.id),
  ]);
  if (!area) notFound();

  const ancestors = await getAncestors(db, area);

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
          <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0">
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
            {session ? (
              userSend ? (
                <EditSendButton climb={climb} send={userSend} />
              ) : (
                <LogSendButton climb={climb} />
              )
            ) : (
              // Quiet stand-in for Log Send: signed-out visitors otherwise
              // never learn ascents can be logged. The continuation brings
              // them straight back here after signing in.
              <AppLink
                href={signInUrl(`/climbs/${climb.id}`)}
                className="text-center text-sm text-muted"
              >
                Sign in to log this climb
              </AppLink>
            )}
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
