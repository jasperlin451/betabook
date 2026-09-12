import { env } from "cloudflare:test";
import { expect, it } from "vitest";

import { createDb } from "@/db/client";
import { DEFAULT_JOURNAL_FILTER } from "@/lib/filters/journal-filter";
import {
  seedFixtureTree,
  seedFixtureUser,
  seedManyClimbs,
  seedManyJournalEntries,
} from "@/test/fixtures";
import { explainQueries } from "@/test/query-plans";
import { resetDb } from "@/test/reset-db";

import { getJournalPage } from "./journal";

function audienceChecks(plan: string) {
  const checks = plan.match(/(CORRELATED )?SCALAR SUBQUERY \d+\nSEARCH content_owner/g) ?? [];
  return {
    perRow: checks.filter((node) => node.startsWith("CORRELATED")),
    perStatement: checks.filter((node) => !node.startsWith("CORRELATED")),
  };
}

async function seedJournal() {
  const db = createDb(env.DB);
  await resetDb(db);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "owner" });
  await seedManyClimbs(db, 3, 50, 1000);
  await seedManyJournalEntries(
    db,
    Array.from({ length: 200 }, (_, i) => ({
      userId: "owner",
      kind: "session" as const,
      climbId: 1000 + (i % 50),
      entryDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      body: `note ${i}`,
    })),
  );
  return db;
}

async function filteredPlan(db: Awaited<ReturnType<typeof seedJournal>>) {
  const plans = await explainQueries(db, () =>
    getJournalPage(db, "owner", "owner", { ...DEFAULT_JOURNAL_FILTER, query: "yosemite" }),
  );
  return plans
    .flat()
    .map((row) => row.detail)
    .join("\n");
}

it("evaluates the owner's audience once per statement, not once per scanned entry", async () => {
  const plan = await filteredPlan(await seedJournal());
  const { perRow, perStatement } = audienceChecks(plan);

  // The entry audience, plus the send-comment check in both the select and the search.
  expect(perStatement).toHaveLength(3);
  // The companion list, whose author varies per row.
  expect(perRow).toHaveLength(1);
});

it("matches ancestor area names without walking the tree for each entry", async () => {
  const plan = await filteredPlan(await seedJournal());

  expect(plan).not.toMatch(/CORRELATED SCALAR SUBQUERY \d+\nCO-ROUTINE ancestors/);
});
