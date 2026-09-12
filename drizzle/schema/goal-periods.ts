import { integer, text, sqliteTable, primaryKey } from "drizzle-orm/sqlite-core";

import { goals } from "./goals";

/** Preserve historical period targets when an owner edits a recurring goal. Progress remains derived from logs. */
export const goalPeriods = sqliteTable(
  "goal_periods",
  {
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    target: integer("target").notNull(),
    repeat: text("repeat", { enum: ["week", "month"] }).notNull(),
    timezone: text("timezone").notNull(),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.startDate] })],
);
