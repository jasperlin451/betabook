import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { climbs } from "./climbs";

export const sends = sqliteTable(
  "sends",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    climbId: integer("climb_id")
      .notNull()
      // A climb with logged sends is historical data, not an aggregate that
      // should disappear with its parent. RESTRICT is also the database-level
      // backstop for deleteClimb's conditional delete under concurrent writes.
      .references(() => climbs.id, { onDelete: "restrict" }),
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
    gradeFeel: text("grade_feel", { enum: ["low", "solid", "high"] })
      .notNull()
      .default("solid"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  // sends_date_desc_idx (the home feed) and sends_user_date_idx (keyset CSV
  // export) contain descending columns, so they are declared in hand-written
  // migrations
  // instead of here, because drizzle-kit doesn't model descending index
  // columns (same reason the nine climbs sort indexes from
  // 0010_climb_sort_indexes.sql aren't in drizzle/schema/climbs.ts).
  // Nothing in this file will tell you it exists, so: getRecentSends is the
  // reason it exists, and changing that query's ORDER BY silently reverts the
  // home page to scanning and sorting the entire sends table.
  (t) => [
    uniqueIndex("sends_user_climb_unique").on(t.userId, t.climbId),
    index("sends_climb_idx").on(t.climbId),
    index("sends_user_idx").on(t.userId),
  ],
);
