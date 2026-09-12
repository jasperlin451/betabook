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

/** Audience checks that search `user` as the content owner. A correlated one is
 * re-run for every candidate row; a plain one is evaluated once per statement. */
function audienceChecks(plan: string) {
  const checks = plan.match(/(CORRELATED )?SCALAR SUBQUERY \d+\nSEARCH content_owner/g) ?? [];
  return {
    perRow: checks.filter((node) => node.startsWith("CORRELATED")),
    perStatement: checks.filter((node) => !node.startsWith("CORRELATED")),
  };
}

it("evaluates the owner's audience once per statement, not once per scanned entry", async () => {
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

  // A text filter is the worst case: it scans the journal rather than stopping
  // at a page, so anything evaluated per row is paid for on every entry.
  const plans = await explainQueries(db, () =>
    getJournalPage(db, "owner", "owner", { ...DEFAULT_JOURNAL_FILTER, query: "yosemite" }),
  );
  const plan = plans
    .flat()
    .map((row) => row.detail)
    .join("\n");
  const { perRow, perStatement } = audienceChecks(plan);

  // The entry's own audience and the send-comment audience for both the
  // projection and the search predicate all resolve from the owner id.
  expect(perStatement).toHaveLength(3);
  // The survivor belongs to the companion list, whose author varies per row.
  expect(perRow).toHaveLength(1);
});
