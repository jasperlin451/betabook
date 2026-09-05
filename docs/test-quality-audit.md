# Test quality audit — September 5, 2026

Reviewed all 72 tracked test files (1,096 executed tests), the Vitest configuration, migration setup, fixtures, and relevant production implementations. The suite has substantial behavioral coverage, especially CSV normalization, validation, database constraints, journal/send synchronization, and privacy read gates. A passing default run nevertheless hides meaningful gaps.

The initial audit below found eight concrete problems. All eight are now repaired, together with the actionable smaller findings in the inventory. Production code is unchanged. The page tests check server-page composition; they do not claim browser rendering or interaction coverage. Tutorial targets and mocked-hook lifecycle tests retain the scope limitations listed below. Tutorials are unchanged because this work changes no user-facing workflow.

## Repairs

| Finding | Repair                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | Two-account privacy fixtures, both toggle directions, unchanged other-account records, and no-write assertions for invalid/signed-out calls.                |
| F2      | Per-test fixture reset/reseed, explicit duplicate-request and aggregate preconditions, and independent backfill/no-op cases. No tests require source order. |
| F3      | The cursor splits the February 2 pair; both pages, identities, order, uniqueness, and terminal state are asserted.                                          |
| F4      | Nonempty climb/area results, actual component/prop assertions, and throwing redirect mocks.                                                                 |
| F5      | Complete retained/new metadata maps, overlap precedence, deduplication, and input preservation.                                                             |
| F6      | Valid user plus a trigger rejecting row 12 after the first ten-row chunk can succeed; assert rollback and exact aggregates for all 12 climbs.               |
| F7      | Capture executed Drizzle SQL and original bindings, then explain those actual statements against migrated D1.                                               |
| F8      | Exact VB/Font title and accurate test name, plus complete canonical/social metadata assertions.                                                             |

Validation results are recorded in [Repair verification](#repair-verification). Historical red–green practice cannot be established from the original passing tests; this repair's deliberate regression probes establish observed red evidence.

## Initial execution evidence

| Check                                                   | Result                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm test`                                             | 72 files, 1,096 tests passed.                                             |
| `pnpm test --sequence.shuffle --sequence.seed=20260905` | 7 files failed; 39 tests failed, 1,057 passed.                            |
| Five targeted mutation probes below                     | All five deliberately broken implementations passed their selected tests. |

The sandbox initially prevented the local Cloudflare worker from binding its loopback port. The test runs above used the approved execution environment. The normal run also emitted an optional Next/OpenTelemetry module-resolution warning but exited successfully. Neither infrastructure issue was counted as a behavioral red test.

## Initial findings (before repair)

### F1 — P1: Privacy mutations are tested with only one account

Location: [actions/account.test.ts](../actions/account.test.ts), lines 36–97.

The fixture contains only `test-user`. Both privacy actions can therefore update every account while still satisfying every assertion. Removing the user-scoping `where(...)` clauses from both updates in `actions/account.ts` left all **7 tests passing**:

```bash
pnpm test actions/account.test.ts
```

Seed a second account with deliberately contrasting settings. For each toggle, establish the initial values locally, assert the target changes, and assert the other account's complete privacy settings remain unchanged. Check stored state after invalid and signed-out calls as well. This is a confirmed test gap, not a claim that production currently lacks its ownership predicate.

### F2 — P2: Shared mutable fixtures make tests depend on order

The fixed shuffled run produced these failures:

| File                                                        | Failed tests |
| ----------------------------------------------------------- | -----------: |
| [db/send-aggregates.test.ts](../db/send-aggregates.test.ts) |           12 |
| [db/queries/sends.test.ts](../db/queries/sends.test.ts)     |           10 |
| [db/queries/climbs.test.ts](../db/queries/climbs.test.ts)   |            5 |
| [actions/moderation.test.ts](../actions/moderation.test.ts) |            4 |
| [lib/moderation.test.ts](../lib/moderation.test.ts)         |            4 |
| [actions/import.test.ts](../actions/import.test.ts)         |            3 |
| [db/queries/journal.test.ts](../db/queries/journal.test.ts) |            1 |

Examples include aggregate totals accumulated across separate `it` blocks, duplicate-request tests using requests created by earlier tests, search tests borrowing another describe block's rating fixtures, and a project-list test affected by a different test sending that project. Import users are distinct, but their sends still change shared climb aggregates. This makes focused regression runs unreliable and makes unrelated test additions change expected results.

Other static examples occur in `db/area-cycle-guard.test.ts` (renaming id 9010 created in a different test), `db/journal-schema.test.ts` (the re-application test invokes the backfill only once itself), and `lib/account.test.ts` (the no-sends case uses an account emptied by the preceding test). A favorable shuffle does not validate those dependencies.

Use per-test resettable fixtures or isolated entities, and keep a genuinely sequential scenario inside one test. An assertion such as “leaves other climbs untouched” should perform its own mutation, rather than only inspect whatever previous tests left behind. Verify both focused execution and shuffled execution after repair.

### F3 — P2: Journal pagination never splits the same-day pair

Location: [db/queries/journal.test.ts](../db/queries/journal.test.ts), lines 192–200.

The first page ends on March 5; both February 2 entries land together on the second page. The test cannot catch a cursor that ignores the entry id. Replacing `(j.entry_date, j.id) < (cursorDate, cursorId)` with `j.entry_date < cursorDate` left the entire file's **36 tests passing**:

```bash
pnpm test db/queries/journal.test.ts
```

Choose a page size that ends between the February 2 entries. Assert exact entry identities and order on both sides, total result length, uniqueness, and terminal cursor state. The same-day boundary must fail under the date-only cursor mutation.

### F4 — P2: Home-page rendering assertions accept a blank page

Location: [app/page.test.tsx](../app/page.test.tsx), lines 81–101.

The visitor test asserts a query was called and the return value is defined; the filtered authenticated test only checks no redirect and a defined return. `null` is defined. Returning `null` immediately before the climb-mode JSX left all **3 tests passing**:

```bash
pnpm test app/page.test.tsx
```

Use nonempty query results and assert that the expected results component receives those records and the parsed filters. Cover area mode separately. To claim rendering or interaction coverage, add a suitable renderer or browser test: calling an async page as a function only checks composition. Redirect mocks in this file and `app/auth-pages.test.tsx` should throw as Next's redirect does, so execution cannot incorrectly continue past the redirect.

### F5 — P2: Metadata accumulation only checks the new page

Location: [lib/climb-search-pages.test.ts](../lib/climb-search-pages.test.ts), lines 6–29.

The test checks incoming send statistics and breadcrumbs, but never checks that existing statistics and breadcrumbs survive. Replacing both merged maps with their incoming maps left both **2 tests passing**:

```bash
pnpm test lib/climb-search-pages.test.ts
```

Assert complete maps containing both old and new ids, incoming precedence on overlapping ids, and unchanged input objects. Existing sent-id assertions already protect that separate union.

### F6 — P2: The rollback test fails on the first write

Location: [actions/import.test.ts](../actions/import.test.ts), lines 173–193.

Every row belongs to `ghost-user`, which has no user record. The first insert violates its foreign key, so no earlier successful write needs to roll back. Replacing the production `db.batch(...)` with sequential awaited statements still passed this focused test:

```bash
pnpm test actions/import.test.ts -t 'commits nothing when the batch fails partway'
```

Result: **1 passed, 26 deselected**. Other tests in this file count batch calls and would detect this particular implementation change; this probe specifically demonstrates that the claimed rollback scenario is not exercised.

Use a valid user and inject a constraint failure in a later statement after an earlier write can succeed. Assert rollback of sends, journal entries, and exact aggregate values for all affected climb ids, plus absence of revalidation. The current aggregate `every()` should also establish that all 12 expected climb records are present.

### F7 — P2: Query-plan tests explain independent SQL

Locations: [db/queries/climbs.test.ts](../db/queries/climbs.test.ts), lines 231 and 422; [db/queries/climbs.large-area.test.ts](../db/queries/climbs.large-area.test.ts), lines 169 and 218; [db/queries/journal.test.ts](../db/queries/journal.test.ts), line 369; [db/queries/sends.test.ts](../db/queries/sends.test.ts), line 924.

These tests construct their own `EXPLAIN QUERY PLAN` statements, some with an explicit `INDEXED BY` chosen in the test. They check that the schema supports those example queries, but cannot detect production changing its predicates, sort, joins, or chosen index while returning identical small-fixture results. The independent journal plan assertion also stayed green during F3's cursor mutation.

Capture the SQL and parameters executed by the actual query function, or expose a shared query builder, then explain that statement against the migrated database. Preserve explicit schema-object checks as schema tests; those serve a separate, valid purpose. This finding concerns the scope of the performance claims, not the usefulness of testing index definitions.

### F8 — P3: A title test does not exercise its named branch

Location: [lib/seo.test.ts](../lib/seo.test.ts), lines 27–31.

“Omits the parenthetical when the converted scale adds nothing” supplies `VB`, whose conversion is the distinct value `3`, and only checks `startsWith("Slab · VB")`. The assertion passes whether a parenthetical is present or absent. Rename the test to match the distinct-conversion case and assert the whole title; test the equal-conversion branch with an input that actually reaches it, if that branch is a supported contract. Other tests in this file already provide meaningful exact title, description, and JSON-LD assertions.

## Review inventory after repair

Every test file is listed below. “No specific finding” means this pass found no concrete defect in the inspected assertions; it does not claim exhaustive behavior coverage or a mutation score. Data-table and demo-data invariant tests were assessed against their actual production-data contracts, not dismissed merely for testing constants.

| File                                              | Assessment                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `actions/account.test.ts`                         | F1 repaired: target transitions and other-account preservation, including invalid and signed-out calls.                                                                              |
| `actions/area-tree.test.ts`                       | Creation success and the new climb are established before comparing untouched pre-existing rows. Existing scope comment accurately distinguishes fixture coverage from the old race. |
| `actions/fts-sync.test.ts`                        | Creation checked through real searches; updated comment points to moderation coverage for rename/delete.                                                                             |
| `actions/import.test.ts`                          | F2/F6 repaired: isolated send/journal state, real late constraint failure, full aggregate rollback assertions; overwrite/retry/revalidation coverage retained.                       |
| `actions/journal.test.ts`                         | Added unchanged-entry assertions after rejected edits and sentinel sends for plain-session creation/deletion. Existing synchronization and stale-read coverage retained.             |
| `actions/moderation.test.ts`                      | Independent fixtures and locally created duplicate/send guards; corrected vanished-entity title. Scope, approval, audit, and email coverage retained.                                |
| `actions/mutations.test.ts`                       | Added update/delete ownership rejection with unchanged send/journal state; the raw-write test now checks the actual trigger cause.                                                   |
| `actions/product-tour.test.ts`                    | Real persisted progress, other-user isolation, stale versions, and invalid-input no-write checks; no specific finding.                                                               |
| `actions/revalidation.test.ts`                    | Duplicate identifiers now assert exact paths as well as deduplication.                                                                                                               |
| `actions/send-statements.test.ts`                 | Meaningful guard failures and rollback state. Deliberately removed journal triggers isolate application guards; separate database suites cover real triggers.                        |
| `app/auth-pages.test.tsx`                         | Throwing redirects, downstream-work exclusion, and actual form component types/props.                                                                                                |
| `app/page.test.tsx`                               | F4 repaired with nonempty results and component/prop composition assertions for visitors, authenticated search, and area search.                                                     |
| `app/projects-view.test.tsx`                      | Exact retained project prefix and overflow flag for 0, 3, 100, and 101 projects.                                                                                                     |
| `app/tutorial/[tourId]/layout.test.tsx`           | Useful throwing redirects, authentication, invalid routes, replay, and update-selection checks; no specific finding.                                                                 |
| `app/users-journal.test.tsx`                      | Actual page/view selection and visitor rejection; structural element inspection does not cover browser rendering.                                                                    |
| `components/journal/journal-entry-row.test.tsx`   | Exact tag-filter hrefs and clearing behavior; no specific finding within that scope.                                                                                                 |
| `components/mobile-app-helper-lifecycle.test.tsx` | Real event prevention and cleanup exercised through captured effects; mocked React hooks do not exercise rerenders or dependencies.                                                  |
| `components/mobile-app-helper.test.tsx`           | Unconditional afterEach global cleanup; dispatch and server-side behavior retained.                                                                                                  |
| `components/nav-link.test.tsx`                    | Checks hidden states and surviving link target; no specific finding.                                                                                                                 |
| `db/area-cycle-guard.test.ts`                     | Rename test creates its own row; causal constraints and valid-control coverage retained.                                                                                             |
| `db/journal-schema.test.ts`                       | Independent per-test fixtures; re-application case runs the backfill twice and compares complete resulting records.                                                                  |
| `db/journal-send-sync.test.ts`                    | Real triggers, migrated data, concrete rollback, and per-test reset; no specific finding.                                                                                            |
| `db/queries/areas.test.ts`                        | Renamed breadcrumb test to the result contract it actually measures. Other ancestry/paging/index coverage retained.                                                                  |
| `db/queries/climbs.large-area.test.ts`            | Actual production query plans; two distinct ratings distinguish ascending/descending sorts.                                                                                          |
| `db/queries/climbs.pagination.test.ts`            | Offset equivalence now also asserts the exact slice under the documented name tie-break.                                                                                             |
| `db/queries/climbs.test.ts`                       | Independent catalogue/rating/pagination fixtures; local same-name candidates; actual query plans and exact offset identities.                                                        |
| `db/queries/journal.privacy.test.ts`              | Exact positive data plus empty negative controls for all five privacy-gated reads.                                                                                                   |
| `db/queries/journal.test.ts`                      | Independent fixtures, cursor split across equal dates, and actual production query-plan checks.                                                                                      |
| `db/queries/moderation.test.ts`                   | Explicit request/approval timestamps oppose primary-key and insertion ordering.                                                                                                      |
| `db/queries/sends.test.ts`                        | Independent aggregate/filter fixtures, actual query plans, and exact 405-record export across dated plus two undated pages with a bounded loop.                                      |
| `db/queries/users.test.ts`                        | Known and missing user results checked; no specific finding.                                                                                                                         |
| `db/schema-objects.test.ts`                       | Valid schema preservation contract; checks real migrated objects and sort directions.                                                                                                |
| `db/send-aggregates.test.ts`                      | Every arithmetic case seeds its own initial sends; untouched-climb case performs its own mutation.                                                                                   |
| `lib/account.test.ts`                             | Independent no-sends account, surviving-send controls, and another requester's pending-request sentinel.                                                                             |
| `lib/action-result.test.ts`                       | Exact success/error mapping and hidden internal-error detail, with restored spies; no specific finding.                                                                              |
| `lib/area-climbs-filter.test.ts`                  | Exact public URL contract complements populated round trip and fixed-point assertions.                                                                                               |
| `lib/climb-search-filter.test.ts`                 | Exact public URL contract complements populated round trip and fixed-point assertions.                                                                                               |
| `lib/climb-search-pages.test.ts`                  | F5 repaired: complete retained/new maps, overlap precedence, deduplication, unchanged inputs.                                                                                        |
| `lib/climb-stats-filter.test.ts`                  | Default, malformed, unbounded, and clamped ranges checked; no specific finding.                                                                                                      |
| `lib/climbs.test.ts`                              | Meaningful discipline and override validation with hostile fields; no specific finding.                                                                                              |
| `lib/contact-action.test.ts`                      | Invalid form explicitly must not call the rate limiter.                                                                                                                              |
| `lib/contact.test.ts`                             | Useful automation, validation, and subject-injection cases; no specific finding.                                                                                                     |
| `lib/format-date.test.ts`                         | Exact civil dates, fallbacks, and a timezone month boundary; no specific finding.                                                                                                    |
| `lib/format.test.ts`                              | Exact pluralization and thousands formatting; no specific finding.                                                                                                                   |
| `lib/grade-histogram.test.ts`                     | Concrete buckets, gaps, counts, null grades, and posted-grade markers; no specific finding.                                                                                          |
| `lib/grades.test.ts`                              | Independent 6B/6a conversion examples replace implementation-table-derived expected values.                                                                                          |
| `lib/import-matching.test.ts`                     | Real competing candidates, ambiguity, truncation, manual overrides, and input preservation; no specific finding.                                                                     |
| `lib/journal-filter.test.ts`                      | Meaningful malformed inputs and populated round trip; no specific finding.                                                                                                           |
| `lib/journal.test.ts`                             | Explicit date injection, validation boundaries, tag normalization, and valid controls; no specific finding.                                                                          |
| `lib/mobile-detection.test.ts`                    | Unconditional global cleanup and storage-access failure coverage.                                                                                                                    |
| `lib/mobile-helper-suspension.test.ts`            | Further acquire/release verifies that unsubscribed listeners receive no callbacks.                                                                                                   |
| `lib/moderation.test.ts`                          | Independent fixtures, local duplicate/send guards, exact surviving requests, and visible controls for negative queue cases.                                                          |
| `lib/product-tour-demo.test.ts`                   | Valid production demo-data consistency and real filter/analytics results; no specific finding.                                                                                       |
| `lib/product-tour-invitation.test.ts`             | Exact selection of copy for new, returning, and update users; no specific finding.                                                                                                   |
| `lib/product-tour-navigation.test.ts`             | Strong version selection and URL cases; registry invariants do not verify that targets exist in mounted demos.                                                                       |
| `lib/product-tour-position.test.ts`               | Concrete clipping and scroll geometry against edge cases; no specific finding.                                                                                                       |
| `lib/product-tour.test.ts`                        | Negative validation only locally; valid progress is exercised by the action suite.                                                                                                   |
| `lib/search-params.test.ts`                       | Explicit parsing and pagination-boundary cases; no specific finding.                                                                                                                 |
| `lib/search-suggestions.test.ts`                  | Exact breadcrumb outputs and empty-input behavior; no specific finding.                                                                                                              |
| `lib/sends-export.test.ts`                        | Meaningful CSV round trip and multiline formula escaping; no specific finding.                                                                                                       |
| `lib/sends-import.test.ts`                        | Failed-row CSV checked through independent Papa parsing of complete records, including quoted multiline text and unmapped columns.                                                   |
| `lib/sends.test.ts`                               | Exact normalized values and valid/invalid boundary cases with explicit dates; no specific finding.                                                                                   |
| `lib/seo.test.ts`                                 | Exact distinct-conversion title and full canonical/OpenGraph/Twitter contract.                                                                                                       |
| `lib/session.test.ts`                             | Real session/admin guards against mocked auth boundary; no specific finding.                                                                                                         |
| `lib/sign-in-redirect.test.ts`                    | Concrete unsafe-URL contrasts and exact encoded continuations; no specific finding.                                                                                                  |
| `lib/slug.test.ts`                                | Exact transliteration, truncation, href, and query outputs; no specific finding.                                                                                                     |
| `lib/user-analytics.test.ts`                      | Hand-calculated progression, streak, calendar, and discipline results; no specific finding.                                                                                          |
| `lib/user-initials.test.ts`                       | Concrete Unicode initials and allowed/disallowed image URLs; no specific finding.                                                                                                    |
| `lib/user-sends-filter.test.ts`                   | Exact public URL contract complements populated round trip and fixed-point assertions.                                                                                               |
| `lib/user-visibility.test.ts`                     | Public/private owner/visitor combinations directly exercised; no specific finding.                                                                                                   |
| `lib/validation.test.ts`                          | Real parsing and FormData extraction with explicit valid/invalid values; no specific finding.                                                                                        |
| `lib/welcome-email.test.ts`                       | Added simultaneous verification callbacks against real D1 and exact once-only delivery assertion.                                                                                    |

## Repair verification

The original five deliberately broken implementations all passed before repair. They now fail on the intended assertions: date-only journal cursor (one failure), dropped old metadata (one), blank home (two), unscoped privacy writes (four), and sequential import commits (one). The last exposes ten persisted sends, proving the error occurs after a successful earlier chunk. Each production file was restored byte-for-byte in a `finally` block.

The original shuffle produced 39 behavioral failures. Per-test isolation fixes are verified with that seed and focused runs, rather than by disabling shuffling or making suites sequential.

`pnpm check` passes, including lint, formatting, Knip, route generation/typecheck, and all **72 files / 1,107 tests**. The optional Next/OpenTelemetry warning remains non-fatal. The original suite had 1,096 tests; no test was skipped to obtain the green result.

- `pnpm test --sequence.shuffle --sequence.seed=20260905`: **72 files / 1,107 tests passed**; this is the original failing seed.
- The focused command below: **7 files / 8 tests passed**, with 225 neighboring tests deselected by `-t`. It checks independent aggregate updates, same-name candidates, duplicate requests, sent-climb guards, backfill re-application, an ordinary rename, and empty-account deletion.
- `git diff --check` and final document formatting checks passed.

```bash
pnpm test db/send-aggregates.test.ts db/queries/climbs.test.ts actions/moderation.test.ts lib/moderation.test.ts db/journal-schema.test.ts db/area-cycle-guard.test.ts lib/account.test.ts -t "moves ratingCount up|returns only the paired area's twin|rejects a duplicate pending request|blocks a discipline change once|is a no-op on re-application|does not fire on updates|is a no-op for a user"
```

All **25 targeted regression probes** below failed for the intended behavioral reason. These are selected probes, not a repository-wide mutation score. The final production diff is empty.

| Probe                   | Focused command (after temporary mutation)                                            | Observed red            |
| ----------------------- | ------------------------------------------------------------------------------------- | ----------------------- |
| `journal-cursor`        | `pnpm test db/queries/journal.test.ts`                                                | 1 behavioral failure(s) |
| `metadata-loss`         | `pnpm test lib/climb-search-pages.test.ts`                                            | 1 behavioral failure(s) |
| `blank-home`            | `pnpm test app/page.test.tsx`                                                         | 2 behavioral failure(s) |
| `account-scope`         | `pnpm test actions/account.test.ts`                                                   | 4 behavioral failure(s) |
| `non-atomic-import`     | `pnpm test actions/import.test.ts -t 'commits nothing when the batch fails partway'`  | 1 behavioral failure(s) |
| `large-query-plan`      | `pnpm test db/queries/climbs.large-area.test.ts -t 'query plan uses\|short prefixes'` | 2 behavioral failure(s) |
| `small-query-plan`      | `pnpm test db/queries/climbs.test.ts -t 'gathers by area_id'`                         | 1 behavioral failure(s) |
| `histogram-query-plan`  | `pnpm test db/queries/climbs.test.ts -t 'reaches its climbs'`                         | 1 behavioral failure(s) |
| `journal-query-plan`    | `pnpm test db/queries/journal.test.ts -t 'seeks journal_user_date_idx'`               | 1 behavioral failure(s) |
| `undated-export-cursor` | `pnpm test db/queries/sends.test.ts -t 'keyset-pages\|constrains both export'`        | 2 behavioral failure(s) |
| `metadata-social-image` | `pnpm test lib/seo.test.ts -t pageMetadata`                                           | 2 behavioral failure(s) |
| `converted-title`       | `pnpm test lib/seo.test.ts -t 'easiest grade'`                                        | 1 behavioral failure(s) |
| `account-delete-scope`  | `pnpm test lib/account.test.ts`                                                       | 3 behavioral failure(s) |
| `project-prefix`        | `pnpm test app/projects-view.test.tsx`                                                | 1 behavioral failure(s) |
| `welcome-claim`         | `pnpm test lib/welcome-email.test.ts -t 'callbacks race'`                             | 1 behavioral failure(s) |
| `unsubscribe`           | `pnpm test lib/mobile-helper-suspension.test.ts`                                      | 1 behavioral failure(s) |
| `contact-limiter-order` | `pnpm test lib/contact-action.test.ts -t 'doesn'\''t reach the limiter'`              | 1 behavioral failure(s) |
| `public-filter-param`   | `pnpm test lib/climb-search-filter.test.ts -t 'fully populated'`                      | 1 behavioral failure(s) |
| `failed-csv-values`     | `pnpm test lib/sends-import.test.ts -t 'original CSV values'`                         | 1 behavioral failure(s) |
| `auth-component`        | `pnpm test app/auth-pages.test.tsx -t 'renders the sign-in form'`                     | 1 behavioral failure(s) |
| `request-order`         | `pnpm test db/queries/moderation.test.ts -t 'pending requests'`                       | 1 behavioral failure(s) |
| `send-ownership`        | `pnpm test actions/mutations.test.ts -t 'send ownership'`                             | 2 behavioral failure(s) |
| `approval-order`        | `pnpm test db/queries/moderation.test.ts -t 'returns approvals'`                      | 1 behavioral failure(s) |
| `converted-grade`       | `pnpm test lib/grades.test.ts -t 'explicitly requested\|converted-scale grade'`       | 3 behavioral failure(s) |
| `denied-storage`        | `pnpm test lib/mobile-detection.test.ts -t 'storage access'`                          | 1 behavioral failure(s) |

Temporary mutations, applied one at a time and restored byte-for-byte:

- `journal-cursor` in `db/queries/journal.ts`: `sql`(j.entry_date, j.id) < (${cursor.entryDate}, ${cursor.id})`` → `sql`j.entry_date < ${cursor.entryDate}``.
- `metadata-loss` in `lib/climb-search-pages.ts`: `sendStats: { ...current.sendStats, ...incoming.sendStats }` → `sendStats: incoming.sendStats`; `areaBreadcrumbs: { ...current.areaBreadcrumbs, ...incoming.areaBreadcrumbs }` → `areaBreadcrumbs: incoming.areaBreadcrumbs`.
- `blank-home` in `app/page.tsx`: `return (     <NavigationPendingProvider>` → `return null;   return (     <NavigationPendingProvider>`.
- `account-scope` in `actions/account.ts`: `await db.update(user).set({ isPrivate }).where(eq(user.id, session.user.id));` → `await db.update(user).set({ isPrivate });`; `await db.update(user).set({ journalVisibility }).where(eq(user.id, session.user.id));` → `await db.update(user).set({ journalVisibility });`.
- `non-atomic-import` in `actions/import.ts`: `await db.batch(statements as [(typeof statements)[number], ...typeof statements]);` → `for (const statement of statements) await statement;`.
- `large-query-plan` in `db/queries/climbs.ts`: `const indexName = isLarge ? SUBTREE_CLIMBS_SORT_INDEX[sort] : "climbs_area_idx";` → `const indexName = "climbs_area_idx";`.
- `small-query-plan` in `db/queries/climbs.ts`: `const indexName = isLarge ? SUBTREE_CLIMBS_SORT_INDEX[sort] : "climbs_area_idx";` → `const indexName = SUBTREE_CLIMBS_SORT_INDEX[sort];`.
- `histogram-query-plan` in `db/queries/climbs.ts`: `WHERE climbs.area_id IN (SELECT id FROM subtree)` → `WHERE +climbs.area_id IN (SELECT id FROM subtree)`.
- `journal-query-plan` in `db/queries/journal.ts`: `ORDER BY j.entry_date DESC, j.id DESC     LIMIT ${pageSize + 1}` → `ORDER BY j.entry_date DESC, j.body, j.id DESC     LIMIT ${pageSize + 1}`.
- `undated-export-cursor` in `db/queries/sends.ts`: `sql`sends.date_sent IS NULL AND sends.id < ${cursor.id}`` → `sql`sends.date_sent IS NULL``.
- `metadata-social-image` in `lib/seo.ts`: `images: [OG_IMAGE],` → `images: [],`.
- `converted-title` in `lib/seo.ts`: `(${converted})` → ``.
- `account-delete-scope` in `lib/account.ts`: `await db.delete(sends).where(eq(sends.userId, userId));` → `await db.delete(sends);`; `and(eq(changeRequests.requestedBy, userId), eq(changeRequests.status, "pending"))` → `eq(changeRequests.status, "pending")`.
- `project-prefix` in `app/users/[id]/projects-view.tsx`: `rows.slice(0, OPEN_PROJECT_PAGE_SIZE)` → `rows.slice(1, OPEN_PROJECT_PAGE_SIZE + 1)`.
- `welcome-claim` in `lib/welcome-email.ts`: `and(eq(user.id, account.id), isNull(user.welcomeEmailSentAt))` → `eq(user.id, account.id)`.
- `unsubscribe` in `lib/mobile-helper-suspension.ts`: `return () => listeners.delete(listener);` → `return () => {};`.
- `contact-limiter-order` in `lib/contact-action.ts`: `const input = validateContactInput(raw);` → `await allowContactSubmission("unknown");     const input = validateContactInput(raw);`.
- `public-filter-param` in `lib/climb-search-filter.ts`: `params.set("mode", "climb");` → `params.set("mode", "area");`.
- `failed-csv-values` in `lib/sends-import.ts`: `headers.map((h) => raw[h] ?? "")` → `headers.map((h) => h === "Country" ? "" : raw[h] ?? "")`.
- `auth-component` in `app/sign-in/page.tsx`: `<SignInForm next=` → `<div next=`.
- `request-order` in `db/queries/moderation.ts`: `.orderBy(changeRequests.requestedAt, changeRequests.id)` → `.orderBy(changeRequests.id)`.
- `send-ownership` in `actions/sends.ts`: `!existing || existing.userId !== session.user.id` → `!existing`.
- `approval-order` in `db/queries/moderation.ts`: `.orderBy(changeRequestApprovals.createdAt)` → `.orderBy(changeRequestApprovals.userId)`.
- `converted-grade` in `lib/grades.ts`: `"6B",` → `"6Z",`; `"6a",` → `"6z",`.
- `denied-storage` in `lib/mobile-detection.ts`: `} catch {     return false;` → `} catch {     throw new Error("Storage unavailable");`.
