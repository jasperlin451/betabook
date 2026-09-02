import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { ClimbActionsMenu } from "@/components/climb-actions-menu";
import { GradeWithTrend } from "@/components/climb-list";
import { ClimbSendList } from "@/components/climb-send-list";
import { EditSendButton } from "@/components/edit-send-button";
import { LogSendButton } from "@/components/log-send-button";
import { LoggedGradeHistogram } from "@/components/logged-grade-histogram";
import { AppLink } from "@/components/ui/app-link";
import { cardClass } from "@/components/ui/card";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Grade } from "@/components/ui/grade";
import { JsonLd } from "@/components/ui/json-ld";
import { SidebarLayout } from "@/components/ui/page-shell";
import { RatingStars } from "@/components/ui/rating-stars";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageTitle, SectionHeading } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import {
  type Area,
  getAncestors,
  getArea,
  getClimb,
  getClimbSendSummary,
  getSendsForClimb,
  getUserSendForClimb,
} from "@/db/queries";
import { missingDescriptionMessage } from "@/lib/descriptions";
import { buildLoggedGradeRows } from "@/lib/grade-histogram";
import { formatGrade } from "@/lib/grades";
import type { AscentStyle as AscentStyleType } from "@/lib/sends";
import { climbDescription, climbJsonLd, climbTitle, locationTrail, pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

type ClimbPageProps = {
  params: Promise<{ id: string }>;
};

// Shared between generateMetadata and the page — see the identical pattern in
// app/areas/[id]/page.tsx for why the whole id -> row lookup is memoized
// rather than the (db, id)-keyed query helper. The area and its ancestor
// chain are keyed the same way so generateMetadata (title, description,
// breadcrumb JSON-LD) and the page share one round trip for each.
const getClimbById = cache(async (id: number) => {
  const db = await getDb();
  return getClimb(db, id);
});

const getAreaById = cache(async (id: number) => getArea(await getDb(), id));

const getAreaAncestors = cache(async (area: Area) => getAncestors(await getDb(), area));

export async function generateMetadata({ params }: ClimbPageProps): Promise<Metadata> {
  const { id } = await params;
  const climbId = Number(id);
  if (!Number.isInteger(climbId)) notFound();

  const climb = await getClimbById(climbId);
  if (!climb) notFound();

  const area = await getAreaById(climb.areaId);
  if (!area) notFound();
  const ancestors = await getAreaAncestors(area);

  const trail = locationTrail([...ancestors.map((a) => a.name), area.name]);
  return pageMetadata({
    title: climbTitle(climb, area.name),
    description: climbDescription(climb, trail),
    path: `/climbs/${climb.id}`,
    ogType: "article",
  });
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
    getAreaById(climb.areaId),
    session ? getUserSendForClimb(db, session.user.id, climb.id).then((s) => s ?? null) : null,
    getSendsForClimb(db, climb.id),
    getClimbSendSummary(db, climb.id),
  ]);
  if (!area) notFound();

  const ancestors = await getAreaAncestors(area);

  const trail = locationTrail([...ancestors.map((a) => a.name), area.name]);
  const breadcrumbCrumbs = [
    { name: "Home", path: "/" },
    ...ancestors.map((a) => ({ name: a.name, path: `/areas/${a.id}` })),
    { name: area.name, path: `/areas/${area.id}` },
    { name: climb.name, path: `/climbs/${climb.id}` },
  ];

  const loggedBreakdown = Object.entries(summary.styleBreakdown).filter(([, count]) => count > 0);
  const loggedGradeRows = buildLoggedGradeRows(
    climb.type,
    summary.suggestedGradeCounts,
    climb.grade,
  );

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={climbJsonLd({
          name: climb.name,
          path: `/climbs/${climb.id}`,
          description: climbDescription(climb, trail),
          crumbs: breadcrumbCrumbs,
        })}
      />
      <AreaBreadcrumbs ancestors={[...ancestors, area]} current={climb} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Eyebrow>Climb</Eyebrow>
          <PageTitle>{climb.name}</PageTitle>
          <div className="mt-1 flex items-center gap-2">
            <Grade size="md">{formatGrade(climb.type, climb.grade)}</Grade>
            <DisciplineChip type={climb.type} />
          </div>
          <p className="mt-1 text-muted">{climb.description || missingDescriptionMessage()}</p>
        </div>
        {session && <ClimbActionsMenu climb={climb} />}
      </div>

      <SidebarLayout
        side="left"
        sidebarWidthClass="lg:w-80"
        sidebar={
          <>
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
                        heading: <Eyebrow>Ascent breakdown</Eyebrow>,
                        stats: loggedBreakdown.map(([type, count]) => ({
                          label: ASCENT_STYLE_LABELS[type as AscentStyleType],
                          value: count,
                        })),
                      },
                    ]
                  : []),
              ]}
            />
            {loggedGradeRows.length > 0 && (
              <div className={cardClass("sm")}>
                <div className="mb-3">
                  <Eyebrow>Logged grades</Eyebrow>
                </div>
                <LoggedGradeHistogram type={climb.type} rows={loggedGradeRows} />
              </div>
            )}
            {session ? (
              userSend ? (
                <EditSendButton climb={climb} send={userSend} />
              ) : (
                <LogSendButton climb={climb} fullWidth />
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
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <SectionHeading>Sends</SectionHeading>
          <ClimbSendList
            climb={climb}
            initialSends={sendsPage.sends}
            initialHasMore={sendsPage.hasMore}
            currentUserId={session?.user.id}
            emptyState={
              <EmptyState
                message="No sends yet — this line is waiting for its first ascent."
                cta={
                  session ? (
                    userSend ? undefined : (
                      <LogSendButton climb={climb} fullWidth />
                    )
                  ) : (
                    <AppLink href={signInUrl(`/climbs/${climb.id}`)} className="text-sm">
                      Sign in to log the first send
                    </AppLink>
                  )
                }
              />
            }
          />
        </div>
      </SidebarLayout>
    </div>
  );
}
