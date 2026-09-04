import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { areas } from "./areas";
import { user } from "./auth";

// The seven structural operations gated behind admin review — see
// lib/moderation.ts. Each area_*/climb_* prefix says which table `entityId`
// points into; there is no FK on entityId itself since it targets either
// `areas` or `climbs` depending on `type`, and a merged/deleted row can
// legitimately stop existing before its request is reviewed.
export const CHANGE_REQUEST_TYPES = [
  "area_edit",
  "area_delete",
  "area_reparent",
  "climb_edit",
  "climb_delete",
  "climb_move",
  "climb_merge",
] as const;

export const changeRequests = sqliteTable(
  "change_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: CHANGE_REQUEST_TYPES }).notNull(),
    entityId: integer("entity_id").notNull(),
    // JSON, shaped per `type` — only the fields the request would *change*
    // (see ChangeRequestPayload in lib/moderation.ts), already validated
    // before being stored. Applying never re-runs user input through
    // validation, only re-checks that the operation is still legal.
    payload: text("payload").notNull(),
    // Null once the requester has deleted their account: decided rows are
    // the audit trail of applied structural changes and outlive the
    // account; the requester's *pending* rows are deleted along with it
    // (see deleteAccount) rather than lingering unowned.
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    // Shown to the requester on rejection (see lib/email.ts).
    reviewNote: text("review_note"),
  },
  (t) => [
    // The admin queue lists pending requests; almost every read is scoped to
    // this status.
    index("change_requests_status_idx").on(t.status),
    index("change_requests_entity_idx").on(t.type, t.entityId),
    // SQLite enforces the requested_by FK on user delete by scanning this
    // table without an index on the column; a "my requests" view needs the
    // same lookup.
    index("change_requests_requested_by_idx").on(t.requestedBy),
    // One pending request per (operation, entity, requester) — a duplicate
    // submit gets a friendly "already pending" error (see
    // submitChangeRequest) instead of a second queue entry. Pending rows
    // always have a requester (account deletion removes them), so the
    // NULLs-are-distinct caveat on unique indexes never applies.
    uniqueIndex("change_requests_pending_unique")
      .on(t.type, t.entityId, t.requestedBy)
      .where(sql`status = 'pending'`),
  ],
);

// Which areas an admin manages — a grant covers the whole subtree beneath
// each row, not just the area itself (see isAdminForArea in
// lib/moderation.ts, which walks the same ancestor chain as
// isAreaOrDescendant). Many-to-many: one admin can cover several regions. No
// assignment UI yet — rows are inserted directly, same as promoting the
// admin role itself (scripts/promote-admin.ts).
export const adminAreaScopes = sqliteTable(
  "admin_area_scopes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.areaId] }),
    index("admin_area_scopes_area_idx").on(t.areaId),
  ],
);

// One row per admin who has approved a pending request. A request touching
// several areas (reparent/move/merge) applies only once every involved area
// is covered by at least one approver who manages it *at decision time* —
// coverage is recomputed live against adminAreaScopes rather than snapshotted
// here, so a revoked grant stops counting on its own (see
// approvalCoverageComplete in lib/moderation.ts). Which admin's approval
// completed coverage lands in changeRequests.reviewedBy; rows here are the
// full set, including the requester's own implicit approval for the sides
// they manage (recorded at submit time).
export const changeRequestApprovals = sqliteTable(
  "change_request_approvals",
  {
    requestId: integer("request_id")
      .notNull()
      .references(() => changeRequests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.userId] })],
);
