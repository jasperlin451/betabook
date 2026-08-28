import { sql } from "drizzle-orm";
import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

// An append-only log, not a counter-with-UPDATE: recomputeAreaTree (see
// db/reindex-areas.ts) claims the next version via INSERT, so a concurrent
// recompute racing for the same version hits a real PRIMARY KEY conflict
// (a thrown error, which rolls back the whole batch) instead of a silent
// 0-row UPDATE that would let its lft/rght writes commit anyway.
export const treeVersion = sqliteTable("tree_version", {
  version: integer("version").primaryKey(),
  computedAt: integer("computed_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
