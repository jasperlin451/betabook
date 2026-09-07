import { sql, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import type { CompanionOption } from "@/lib/journal-companions";

import { journalVisibleSql } from "./content-access";

/** Correlated only with already selected journal rows / final feed previews.
 * The partial index excludes arbitrarily many self-removal tombstones. */
export function companionsJsonSql(viewerId: string | null, entryId: SQL): SQL {
  return sql`(SELECT json_group_array(json_object('id', companion.id, 'name', companion.name,
    'isSelf', json(CASE WHEN companion.id = ${viewerId} THEN 'true' ELSE 'false' END)))
    FROM journal_companions jc INDEXED BY journal_companions_active_idx
    JOIN journal_entries tagged_entry ON tagged_entry.id = jc.entry_id
    JOIN user companion ON companion.id = jc.user_id
    JOIN friendships tagged_friendship ON tagged_friendship.user_id = jc.friendship_user_id
      AND tagged_friendship.friend_id = jc.friendship_friend_id
    WHERE jc.entry_id = ${entryId} AND jc.suppressed = 0 AND companion.is_private = 0
      AND tagged_friendship.status = 'accepted'
      AND ${journalVisibleSql(viewerId, sql`tagged_entry.user_id`)}
      AND (tagged_entry.user_id = ${viewerId} OR ${journalVisibleSql(viewerId, sql`companion.id`)})
  )`;
}

export async function searchCompanionFriends(
  db: Database,
  ownerId: string,
  name: string,
): Promise<CompanionOption[]> {
  const query = name.trim().slice(0, 100);
  if (!query) return [];
  return db.all<CompanionOption>(sql`
    WITH friends AS (
      SELECT friend_id AS id FROM friendships WHERE user_id = ${ownerId} AND status = 'accepted'
      UNION ALL SELECT user_id AS id FROM friendships WHERE friend_id = ${ownerId} AND status = 'accepted'
    )
    SELECT u.id, u.name FROM friends f CROSS JOIN user u ON u.id = f.id
    WHERE u.is_private = 0 AND substr(u.name, 1, length(${query})) = ${query} COLLATE NOCASE
    ORDER BY u.name COLLATE NOCASE, u.id LIMIT 20
  `);
}
