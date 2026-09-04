import type { Metadata } from "next";

import { ApproveRejectControls } from "@/components/admin/approve-reject-controls";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getUser } from "@/db/queries";
import { describeChangeRequest, getVisibleChangeRequests } from "@/lib/moderation";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Review requests" };

const REQUESTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function AdminRequestsPage() {
  const session = await requireAdmin();
  const db = await getDb();

  const requests = await getVisibleChangeRequests(db, session);
  const rows = await Promise.all(
    requests.map(async (request) => {
      const [requester, { summary, href }] = await Promise.all([
        getUser(db, request.requestedBy),
        describeChangeRequest(db, request),
      ]);
      return { request, requesterName: requester?.name ?? "Unknown", summary, href };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle className="text-2xl">Review requests</PageTitle>

      {rows.length === 0 ? (
        <EmptyState message="No pending requests in your managed areas." />
      ) : (
        <div className="flex flex-col divide-y divide-separator">
          {rows.map(({ request, requesterName, summary, href }) => (
            <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                {href ? (
                  <AppLink href={href} className="text-sm font-medium">
                    {summary}
                  </AppLink>
                ) : (
                  <span className="text-sm font-medium text-muted">
                    {summary} (no longer exists)
                  </span>
                )}
                <span className="text-xs text-muted">
                  Requested by {requesterName} on {REQUESTED_AT_FORMAT.format(request.requestedAt)}
                </span>
              </div>
              <ApproveRejectControls requestId={request.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
