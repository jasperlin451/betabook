import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database } from "@/db/client";
import { changeRequests } from "@/db/schema";
import { seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

import { submitChangeRequest } from "./moderation";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "moderation-requester" });
});

describe("submitChangeRequest", () => {
  it("stores the payload as JSON on a pending row and returns its id", async () => {
    const id = await submitChangeRequest(db, "area_edit", 1, "moderation-requester", {
      name: "Renamed Crag",
      description: null,
    });

    const row = await db.select().from(changeRequests).where(eq(changeRequests.id, id)).get();
    expect(row?.type).toBe("area_edit");
    expect(row?.entityId).toBe(1);
    expect(row?.requestedBy).toBe("moderation-requester");
    expect(row?.status).toBe("pending");
    expect(row?.reviewedBy).toBeNull();
    expect(JSON.parse(row?.payload ?? "")).toEqual({ name: "Renamed Crag", description: null });
  });

  it("gives each request its own id", async () => {
    const first = await submitChangeRequest(db, "climb_delete", 1, "moderation-requester", {});
    const second = await submitChangeRequest(db, "climb_delete", 2, "moderation-requester", {});
    expect(first).not.toBe(second);
  });
});
