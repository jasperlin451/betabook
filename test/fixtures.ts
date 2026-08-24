import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas, climbs, user, sends } from "@/db/schema";

/**
 * A small tree exercising: a root with no ancestors, a two-level-deep
 * ancestor chain, an area whose climbs live only on its descendants (not
 * itself), and a leaf area with climbs directly attached.
 *
 *   Test Crag (1)                          lft=1  rght=10
 *   ├── Test Boulders (2)                  lft=2  rght=7
 *   │   ├── Test Highball Alcove (4)       lft=3  rght=4   -> climb: Test Highball (boulder, V4)
 *   │   └── Test Slab Area (5)             lft=5  rght=6   -> climb: Test Slab (boulder, V1)
 *   └── Test Sport Wall (3)                lft=8  rght=9   -> climbs: Test Crimper (sport, 5.10a),
 *                                                              Test Crack (trad, 5.6)
 */
export async function seedFixtureTree(db: Database) {
  await db.insert(areas).values([
    { id: 1, parentId: null, lft: 1, rght: 10, name: "Test Crag", description: "A test crag." },
    { id: 2, parentId: 1, lft: 2, rght: 7, name: "Test Boulders" },
    { id: 3, parentId: 1, lft: 8, rght: 9, name: "Test Sport Wall" },
    { id: 4, parentId: 2, lft: 3, rght: 4, name: "Test Highball Alcove" },
    { id: 5, parentId: 2, lft: 5, rght: 6, name: "Test Slab Area" },
  ]);

  await db.insert(climbs).values([
    { id: 1, areaId: 4, name: "Test Highball", type: "boulder", grade: 5 }, // V4
    { id: 2, areaId: 5, name: "Test Slab", type: "boulder", grade: 2 }, // V1
    { id: 3, areaId: 3, name: "Test Crimper", type: "sport", grade: 10 }, // 5.10a
    { id: 4, areaId: 3, name: "Test Crack", type: "trad", grade: 6 }, // 5.6
  ]);

  await db.run(sql`INSERT INTO areas_fts(rowid, name) SELECT id, name FROM areas`);
  await db.run(sql`INSERT INTO climbs_fts(rowid, name) SELECT id, name FROM climbs`);
}

/** Inserts `count` boulder climbs into `areaId`, for pagination tests. */
export async function seedManyClimbs(
  db: Database,
  areaId: number,
  count: number,
  startId: number,
) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    areaId,
    name: `Bulk Climb ${i}`,
    type: "boulder" as const,
    grade: i % 19,
  }));
  // D1 has a bound-parameter limit per statement, so chunk the insert.
  const CHUNK_SIZE = 20;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await db.insert(climbs).values(rows.slice(i, i + CHUNK_SIZE));
  }
  await db.run(sql`INSERT INTO climbs_fts(rowid, name) SELECT id, name FROM climbs WHERE id >= ${startId}`);
}

/** Inserts `count` unrelated root-level areas, each its own leaf, sharing a
 * common name prefix — for exercising an area-name filter that matches many
 * areas at once (regression coverage: matching N areas used to bind 2 SQL
 * parameters per match, blowing past D1's per-statement bound-parameter
 * limit — the same limit `seedManyClimbs`'s chunking works around). */
export async function seedManyAreas(db: Database, count: number, startId: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    parentId: null,
    lft: 100_000 + i * 2,
    rght: 100_000 + i * 2 + 1,
    name: `Bulk Area ${i}`,
  }));
  const CHUNK_SIZE = 20;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await db.insert(areas).values(rows.slice(i, i + CHUNK_SIZE));
  }
  await db.run(
    sql`INSERT INTO areas_fts(rowid, name) SELECT id, name FROM areas WHERE id >= ${startId}`,
  );
}

type FixtureUserOverrides = Partial<typeof user.$inferInsert> & { id: string };

/** Inserts a minimal `user` row for send-query tests; `id` must be unique per call. */
export async function seedFixtureUser(db: Database, overrides: FixtureUserOverrides) {
  const row = {
    name: "Test Climber",
    email: `${overrides.id}@example.com`,
    ...overrides,
  };
  await db.insert(user).values(row);
  return row;
}

type FixtureSendOverrides = Partial<typeof sends.$inferInsert> & {
  userId: string;
  climbId: number;
  dateSent: string | null;
};

/** Inserts a `sends` row referencing an existing fixture user/climb. */
export async function seedFixtureSend(db: Database, overrides: FixtureSendOverrides) {
  const row = {
    completionType: "redpoint" as const,
    comment: null,
    rating: null,
    suggestedGrade: null,
    ...overrides,
  };
  await db.insert(sends).values(row);
  return row;
}
