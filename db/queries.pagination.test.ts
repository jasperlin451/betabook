import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import { getArea, getSubtreeClimbs } from "./queries";
import { areas } from "./schema";
import { seedManyClimbs } from "@/test/fixtures";

// Isolated from queries.test.ts's fixture tree on purpose: searchClimbs there
// searches globally (no area scoping), so bulk climbs from a pagination test
// would otherwise leak into and break those tests' expected result sets.

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await db.insert(areas).values({
    id: 1,
    parentId: null,
    lft: 1,
    rght: 2,
    name: "Pagination Test Area",
  });
  await seedManyClimbs(db, 1, 55, 1000);
});

describe("getSubtreeClimbs pagination", () => {
  it("returns a full page and reports hasNextPage when more rows remain", async () => {
    const area = await getArea(db, 1);
    const page1 = await getSubtreeClimbs(db, area!, 1);
    expect(page1.climbs.length).toBe(50);
    expect(page1.hasNextPage).toBe(true);
  });

  it("returns the remainder and reports no next page on the last page", async () => {
    const area = await getArea(db, 1);
    const page2 = await getSubtreeClimbs(db, area!, 2);
    expect(page2.climbs.length).toBe(5);
    expect(page2.hasNextPage).toBe(false);
  });
});
