import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, real, index } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";

export const climbs = sqliteTable(
  "climbs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["boulder", "sport", "trad"] }).notNull(),
    grade: integer("grade"),
    description: text("description"),
    // Denormalized copy of the owning area's areas.lft/rght, kept in sync
    // by every writer of areas.lft/rght: insertAreaIntoTree shifts climbs
    // and areas in the same atomic batch, recomputeAreaTree resyncs all
    // climbs after renumbering (both in db/reindex-areas.ts), and the
    // offline reindex step (scripts/reindex-areas.ts) does the same for
    // seeded data — lets getSubtreeClimbs filter by subtree range directly
    // on climbs, with no join to areas, so the range predicate and a
    // sort-column index can cooperate in a single-table query plan.
    lft: integer("lft").notNull().default(0),
    rght: integer("rght").notNull().default(0),
    // Denormalized aggregates over `sends`, incrementally maintained by
    // every write path in db/mutations.ts — lets getSubtreeClimbs sort by
    // ascent count/rating from an index on climbs alone, instead of joining
    // an unscoped GROUP BY over the entire sends table on every query.
    // ratingSum/ratingCount (not a running average) avoid floating-point
    // drift accumulating over years of incremental +/- updates.
    sendCount: integer("send_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    avgRating: real("avg_rating").generatedAlwaysAs(
      sql`CASE WHEN rating_count > 0 THEN CAST(rating_sum AS REAL) / rating_count ELSE NULL END`,
      { mode: "virtual" },
    ),
  },
  (t) => [
    index("climbs_area_idx").on(t.areaId),
    index("climbs_type_grade_idx").on(t.type, t.grade),
  ],
);
