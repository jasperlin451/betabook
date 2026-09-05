import type { Metadata } from "next";

import { requireAdminOrRedirect } from "@/app/admin/require-admin";
import { ApproveRejectControls } from "@/components/admin/approve-reject-controls";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getArea, getManagedAreas, getUser } from "@/db/queries";
import {
  changeRequestCoverage,
  describeChangeRequest,
  getVisibleChangeRequests,
} from "@/lib/moderation";
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

  const [managedAreas, requests] = await Promise.all([
    getManagedAreas(db, session.user.id),
    getVisibleChangeRequests(db, session),
  ]);
  const rows = await Promise.all(
    requests.map(async (request) => {
      const [requester, description, coverage] = await Promise.all([
        request.requestedBy ? getUser(db, request.requestedBy) : undefined,
        describeChangeRequest(db, request),
        changeRequestCoverage(db, request),
      ]);
      const [approvers, missingAreas] = await Promise.all([
        Promise.all(coverage.approverIds.map((id) => getUser(db, id))),
        Promise.all(coverage.missingAreaIds.map((id) => getArea(db, id))),
      ]);
      return {
        request,
        requesterName: requester?.name ?? "a deleted account",
        description,
        entityGone: coverage.scopeAreaIds.length === 0,
        isMine: request.requestedBy === session.user.id,
        alreadyApproved: coverage.approverIds.includes(session.user.id),
        approverNames: approvers.flatMap((approver) => (approver ? [approver.name] : [])),
        missingAreaNames: missingAreas.flatMap((area) => (area ? [area.name] : [])),
      };
    }),
  );

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
              entityGone,
              isMine,
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
                <ApproveRejectControls
                  requestId={request.id}
                  isMine={isMine}
                  entityGone={entityGone}
                  alreadyApproved={alreadyApproved}
                />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
