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
