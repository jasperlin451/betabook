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
    // Denormalized aggregates over `sends`, incrementally maintained by
    // AFTER INSERT/UPDATE/DELETE triggers on sends (see
    // drizzle/migrations/0014_sends_aggregate_triggers.sql) — lets
    // getSubtreeClimbs sort by ascent count/rating from an index on climbs
    // alone, instead of joining an unscoped GROUP BY over the entire sends
    // table on every query. App code never writes these columns; the
    // triggers are the only writer, so no send write path can forget them.
    // ratingSum/ratingCount (not a running average) avoid floating-point
    // drift accumulating over years of incremental +/- updates.
    sendCount: integer("send_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    avgRating: real("avg_rating").generatedAlwaysAs(
      sql`CASE WHEN rating_count > 0 THEN CAST(rating_sum AS REAL) / rating_count ELSE NULL END`,
      { mode: "virtual" },
    ),
    // The reported grade a send contributes is its suggested grade shifted by
    // the climber's grade feel. Stored in tenths as an integer for the same
    // reason the rating keeps a sum and a count: a running real average drifts
    // under years of incremental +/- updates. GRADE_FEEL_TENTHS in lib/sends.ts
    // owns the shift and must stay in step with the triggers that apply it.
    suggestedGradeTenthsSum: integer("suggested_grade_tenths_sum").notNull().default(0),
    suggestedGradeCount: integer("suggested_grade_count").notNull().default(0),
    avgSuggestedGrade: real("avg_suggested_grade").generatedAlwaysAs(
      sql`CASE WHEN suggested_grade_count > 0
        THEN CAST(suggested_grade_tenths_sum AS REAL) / (10.0 * suggested_grade_count)
        ELSE NULL END`,
      { mode: "virtual" },
    ),
  },
  (t) => [
    index("climbs_area_idx").on(t.areaId),
    index("climbs_type_grade_idx").on(t.type, t.grade),
  ],
);
