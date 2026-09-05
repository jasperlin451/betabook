import type { Metadata } from "next";

import { requireAdminOrRedirect } from "@/app/admin/require-admin";
import { ApproveRejectControls } from "@/components/admin/approve-reject-controls";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getAreasByIds, getManagedAreas, getUsersByIds } from "@/db/queries";
import { changeRequestCoverage, describeChangeRequest, getReviewQueue } from "@/lib/moderation";
import { areaHref } from "@/lib/slug";

export const metadata: Metadata = { title: "Review requests" };

const REQUESTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function AdminRequestsPage() {
  const session = await requireAdminOrRedirect();
  const db = await getDb();

  const [managedAreas, queue] = await Promise.all([
    getManagedAreas(db, session.user.id),
    getReviewQueue(db, session),
  ]);

  // Per-row work reuses what the queue already derived (scope ids) and what
  // coverage already loaded (approver names); requester names and
  // missing-area names batch into one IN query each across the whole page —
  // every query here counts against the Workers subrequest cap.
  const described = await Promise.all(
    queue.map(async ({ request, scopeAreaIds }) => {
      const [description, coverage] = await Promise.all([
        describeChangeRequest(db, request),
        changeRequestCoverage(db, request, scopeAreaIds),
      ]);
      return { request, description, coverage };
    }),
  );
  const [requesters, missingAreas] = await Promise.all([
    getUsersByIds(db, [...new Set(described.flatMap(({ request }) => request.requestedBy ?? []))]),
    getAreasByIds(db, [...new Set(described.flatMap(({ coverage }) => coverage.missingAreaIds))]),
  ]);
  const requesterNames = new Map(requesters.map((requester) => [requester.id, requester.name]));
  const areaNames = new Map(missingAreas.map((area) => [area.id, area.name]));

  const rows = described.map(({ request, description, coverage }) => ({
    request,
    description,
    requesterName:
      (request.requestedBy && requesterNames.get(request.requestedBy)) ?? "a deleted account",
    alreadyApproved: coverage.approvers.some((approver) => approver.id === session.user.id),
    approverNames: coverage.approvers.map((approver) => approver.name),
    missingAreaNames: coverage.missingAreaIds.flatMap((id) => areaNames.get(id) ?? []),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PageTitle className="text-2xl">Review requests</PageTitle>
        {/* Just the granted areas — each one covers its whole subtree, so
            expanding the tree here would bury the actual grants. */}
        {managedAreas.length > 0 ? (
          <p className="text-sm text-muted">
            Areas you moderate:{" "}
            {managedAreas.map((area, i) => (
              <span key={area.id}>
                {i > 0 && ", "}
                <AppLink href={areaHref(area.id, area.name)} className="text-foreground">
                  {area.name}
                </AppLink>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-muted">
            You don&apos;t moderate any areas yet — requests will appear here once you&apos;re
            granted one.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No pending requests in your managed areas." />
      ) : (
        <div className="flex flex-col divide-y divide-separator">
          {rows.map(
            ({
              request,
              requesterName,
              description,
              alreadyApproved,
              approverNames,
              missingAreaNames,
            }) => (
              <div
                key={request.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  {description.href ? (
                    <AppLink href={description.href} className="text-sm font-medium">
                      {description.summary}
                    </AppLink>
                  ) : (
                    <span className="text-sm font-medium text-muted">
                      {description.summary} (no longer exists)
                    </span>
                  )}
                  {description.details.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-xs text-muted">
                      {description.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  )}
                  <span className="text-xs text-muted">
                    Requested by {requesterName} on{" "}
                    {REQUESTED_AT_FORMAT.format(request.requestedAt)}
                  </span>
                  {approverNames.length > 0 && missingAreaNames.length > 0 && (
                    <span className="text-xs text-muted">
                      Approved by {approverNames.join(", ")} — still needs an admin for{" "}
                      {missingAreaNames.join(", ")}
                    </span>
                  )}
                </div>
                <ApproveRejectControls requestId={request.id} alreadyApproved={alreadyApproved} />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
