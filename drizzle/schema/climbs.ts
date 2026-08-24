import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { areas } from "./areas";

export const climbs = sqliteTable(
  "climbs",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["boulder", "sport", "trad"] }).notNull(),
    grade: integer("grade"),
    description: text("description"),
  },
  (t) => [
    index("climbs_area_idx").on(t.areaId),
    index("climbs_type_grade_idx").on(t.type, t.grade),
  ],
);
