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
    id: integer("id").primaryKey({ autoIncrement: true }),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => areas.id,
      { onDelete: "restrict" },
    ),
    name: text("name").notNull(),
    description: text("description"),
  },
  // areas_parent_idx is the whole tree index: every subtree and ancestor
  // query walks parent_id through a recursive CTE, and SQLite reads this as
  // a covering index for that walk.
  (t) => [index("areas_parent_idx").on(t.parentId)],
);
