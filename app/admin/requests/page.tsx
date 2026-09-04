import type { Metadata } from "next";

import { ApproveRejectControls } from "@/components/admin/approve-reject-controls";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/typography";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { getArea, getClimb, getUser, type ChangeRequest } from "@/db/queries";
import {
  getVisibleChangeRequests,
  type ChangeRequestPayload,
  type ChangeRequestType,
} from "@/lib/moderation";
import { requireAdmin } from "@/lib/session";
import { areaHref, climbHref } from "@/lib/slug";

export const metadata: Metadata = { title: "Review requests" };

const REQUESTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type RequestDescription = { summary: string; href: string | null };

// One describer per request type, dispatched by `request.type` — a plain
// record instead of a switch so each case stays small and self-contained.
const REQUEST_DESCRIBERS: Record<
  ChangeRequestType,
  (db: Database, request: ChangeRequest) => Promise<RequestDescription>
> = {
  area_edit: async (db, request) => {
    const area = await getArea(db, request.entityId);
    const { name } = JSON.parse(request.payload) as ChangeRequestPayload["area_edit"];
    return {
      summary: `Rename "${area?.name ?? "an area"}" to "${name}"`,
      href: area ? areaHref(area.id, area.name) : null,
    };
  },
  area_delete: async (db, request) => {
    const area = await getArea(db, request.entityId);
    return {
      summary: `Delete "${area?.name ?? "an area"}"`,
      href: area ? areaHref(area.id, area.name) : null,
    };
  },
  area_reparent: async (db, request) => {
    const { newParentId } = JSON.parse(request.payload) as ChangeRequestPayload["area_reparent"];
    const [area, newParent] = await Promise.all([
      getArea(db, request.entityId),
      getArea(db, newParentId),
    ]);
    return {
      summary: `Move "${area?.name ?? "an area"}" under "${newParent?.name ?? "another area"}"`,
      href: area ? areaHref(area.id, area.name) : null,
    };
  },
  climb_edit: async (db, request) => {
    const climb = await getClimb(db, request.entityId);
    const { name } = JSON.parse(request.payload) as ChangeRequestPayload["climb_edit"];
    return {
      summary: `Rename "${climb?.name ?? "a climb"}" to "${name}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
    };
  },
  climb_delete: async (db, request) => {
    const climb = await getClimb(db, request.entityId);
    return {
      summary: `Delete "${climb?.name ?? "a climb"}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
    };
  },
  climb_move: async (db, request) => {
    const { newAreaId } = JSON.parse(request.payload) as ChangeRequestPayload["climb_move"];
    const [climb, newArea] = await Promise.all([
      getClimb(db, request.entityId),
      getArea(db, newAreaId),
    ]);
    return {
      summary: `Move "${climb?.name ?? "a climb"}" to "${newArea?.name ?? "another area"}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
    };
  },
  climb_merge: async (db, request) => {
    const { targetClimbId } = JSON.parse(request.payload) as ChangeRequestPayload["climb_merge"];
    const [source, target] = await Promise.all([
      getClimb(db, request.entityId),
      getClimb(db, targetClimbId),
    ]);
    return {
      summary: `Merge "${source?.name ?? "a climb"}" into "${target?.name ?? "another climb"}"`,
      href: source ? climbHref(source.id, source.name) : null,
    };
  },
};

/** A short "what's being asked for" line plus a link to the affected entity
 * — the queue's whole point is letting an admin tell at a glance whether
 * something is worth a closer look, not a full diff. */
function describeRequest(db: Database, request: ChangeRequest): Promise<RequestDescription> {
  return REQUEST_DESCRIBERS[request.type](db, request);
}

export default async function AdminRequestsPage() {
  const session = await requireAdmin();
  const db = await getDb();

  const requests = await getVisibleChangeRequests(db, session);
  const rows = await Promise.all(
    requests.map(async (request) => {
      const [requester, { summary, href }] = await Promise.all([
        getUser(db, request.requestedBy),
        describeRequest(db, request),
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
