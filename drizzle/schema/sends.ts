import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { climbs } from "./climbs";
import { user } from "./auth";

export const sends = sqliteTable(
  "sends",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    climbId: integer("climb_id")
      .notNull()
      .references(() => climbs.id, { onDelete: "cascade" }),
    ascentStyle: text("ascent_style", {
      enum: ["redpoint", "flash", "onsight"],
    }).notNull(),
    // ISO date (YYYY-MM-DD) — when the climb was actually sent, not when
    // this row was logged/edited (that's createdAt/updatedAt below). Nullable
    // since older/imported sends often have no recorded date at all.
    dateSent: text("date_sent"),
    comment: text("comment"),
    rating: integer("rating"), // 1-5, nullable = abstained
    suggestedGrade: integer("suggested_grade"), // same ordinal space as climbs.grade, scoped by climb.type
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("sends_user_climb_unique").on(t.userId, t.climbId),
    index("sends_climb_idx").on(t.climbId),
    index("sends_user_idx").on(t.userId),
  ],
);
