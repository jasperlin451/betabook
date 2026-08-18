import {
  sqliteTable,
  integer,
  text,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const areas = sqliteTable(
  "areas",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => areas.id,
      { onDelete: "restrict" },
    ),
    lft: integer("lft").notNull(),
    rght: integer("rght").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => [
    index("areas_parent_idx").on(t.parentId),
    index("areas_lft_idx").on(t.lft),
    index("areas_rght_idx").on(t.rght),
  ],
);

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
  },
  (t) => [
    index("climbs_area_idx").on(t.areaId),
    index("climbs_type_grade_idx").on(t.type, t.grade),
  ],
);
