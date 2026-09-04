import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index, primaryKey } from "drizzle-orm/sqlite-core";

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
    // JSON, shaped per `type` — already validated (validateAreaInput /
    // validateClimbInput) before being stored, so approving a request never
    // re-runs user input through validation. See lib/moderation.ts.
    payload: text("payload").notNull(),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
