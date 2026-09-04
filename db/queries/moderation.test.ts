import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database } from "@/db/client";
import { changeRequests } from "@/db/schema";
import { seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

import { getChangeRequest, getPendingChangeRequests } from "./moderation";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "queries-requester" });

  await db.insert(changeRequests).values([
    { id: 101, type: "area_edit", entityId: 1, payload: "{}", requestedBy: "queries-requester" },
    { id: 102, type: "climb_delete", entityId: 1, payload: "{}", requestedBy: "queries-requester" },
    {
      id: 103,
      type: "climb_delete",
      entityId: 2,
      payload: "{}",
      requestedBy: "queries-requester",
      status: "approved",
      reviewedBy: "queries-requester",
    },
  ]);
});

describe("getChangeRequest", () => {
  it("returns the row for a known id", async () => {
    const request = await getChangeRequest(db, 101);
    expect(request?.type).toBe("area_edit");
  });

  it("returns undefined for an unknown id", async () => {
    expect(await getChangeRequest(db, 999999)).toBeUndefined();
  });
});

describe("getPendingChangeRequests", () => {
  it("only returns pending requests, oldest first", async () => {
    const pending = await getPendingChangeRequests(db);
    const ids = pending.map((r) => r.id);
    expect(ids).toContain(101);
    expect(ids).toContain(102);
    expect(ids).not.toContain(103);
    expect(ids.indexOf(101)).toBeLessThan(ids.indexOf(102));
  });
});
