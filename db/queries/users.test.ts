import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { getUser } from "./users";
import { seedFixtureUser } from "@/test/fixtures";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureUser(db, { id: "test-user-1", name: "Alice Climber" });
});

describe("getUser", () => {
  it("returns the user for a known id", async () => {
    const user = await getUser(db, "test-user-1");
    expect(user?.name).toBe("Alice Climber");
  });

  it("returns undefined for an unknown id", async () => {
    const user = await getUser(db, "no-such-user");
    expect(user).toBeUndefined();
  });
});
