# Unified search design review

Status: **Design approved; integrated into the app.**

## Open the stories

The review server runs at `http://127.0.0.1:6008`. To restart it, run
`pnpm exec storybook dev --host 127.0.0.1 --port 6008 --no-open`.

| Surface        | Review link                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick search   | [Open dialog](http://127.0.0.1:6008/?path=/story/patterns-search--quick-search)                                                                                                                                                     |
| Full results   | [Browse categories and filters](http://127.0.0.1:6008/?path=/story/patterns-search--full-results)                                                                                                                                   |
| Search journey | [Expand quick search with preserved state](http://127.0.0.1:6008/?path=/story/patterns-search--search-journey)                                                                                                                      |
| Local filters  | [Area climbs](http://127.0.0.1:6008/?path=/story/patterns-filters--area-climbs), [Sends](http://127.0.0.1:6008/?path=/story/patterns-filters--sends), [Journal](http://127.0.0.1:6008/?path=/story/patterns-filters--journal)       |
| Climb picker   | [Logging](http://127.0.0.1:6008/?path=/story/patterns-search--climb-picker), [Import](http://127.0.0.1:6008/?path=/story/patterns-search--import-picker), [Merge](http://127.0.0.1:6008/?path=/story/patterns-search--merge-picker) |
| Record pickers | [Area identity](http://127.0.0.1:6008/?path=/story/patterns-search--area-picker), [Companions](http://127.0.0.1:6008/?path=/story/patterns-search--companion-picker)                                                                |

The same collection includes initial, loading, no-match, complete/partial failure,
selected climb, long name and missing grade states. Quick search has separate
initial/loading/no-match/failure stories with the dialog already open. Merge
shows the disabled source record; logging allows repeats. Each example has only
local effects, including its selection summary and simulated navigation.

Use the Storybook toolbar to switch between Paper and Ink.

## Integrated behavior

- The header shortcut and search button open the shared quick dialog. Expanding
  preserves the query, category and explicit area scope in the full-results URL.
- The header has one Search button, with no duplicate navigation link. The full
  page retains its Search heading and has one name field; the extra In area
  lookup was removed after review. Existing scopes remain visible and removable.
- All categories wait for a nonempty query, including the anonymous homepage and
  climb picker. The empty prompt and placeholder match the selected category.
  Area suggestions appear only in All or Climbs; climber search is global.
  Empty logging pickers show one prompt without a result heading or footer.
- Logging and merge pickers omit the area lookup. Import keeps its explicit
  location lookup. Live picker pagination was verified against seeded data:
  25 initial records became 50 after Load more, retaining the first record and
  keyboard focus on Load more.
- Full results server-render the first page, use the existing paginated APIs,
  support independent category failures and Retry, and retain grade, rating,
  ascent-count and sorting controls. Climber results retain friendship actions
  and the current-viewer refresh boundary.
- Area climbs, Sends and Journal use `FilterInput` directly above their lists.
  Area filters select an identity and query its exact subtree.
- Logging, import matching, and merge selection use the shared climb rows and
  fields. Import area text stays a hint until selected. Merge disables the source
  climb and permits a destination already in the logbook. Area create/edit/move
  forms and companion selection share the identity lookup field.
- The old palette dialog, search forms/results, category switch, route/area
  fields, generic search combobox, unused area/climber lists, and old search hooks
  were removed. Existing server API guards and domain mutations remain in place.

The display components still have controlled props. App controllers own network,
URL state, and navigation. Storybook injects only those external boundaries and
never navigates or writes using sample IDs. The discovery lesson now shows the
same search controller; version 2 and stable lesson IDs are retained because that
update is unreleased.

Compact rows continue to truncate long names and locations, with both in the
accessible label. Lookup choices display ancestry; the selected area chip shows
its name. The quick dialog keeps its field and footer reachable while the results
scroll on small or short screens.

## Integration verification

- The first app journey run failed because the old app had no All category. It
  passed after integration.
- Running the scoped journey against the production controller caught a state
  update that lost the Climbs category while applying an area. The corrected
  controller passes the same assertion.
- Exact-area parsing failed before implementation. Deliberately broadening the
  database scope made both climb and Sends tests return sibling and duplicate
  records; the correct SQL was immediately restored and the tests pass.
- Storybook now tests the production controller's category retries, pagination
  retries, import scope selection, stale-result prevention, and area identity.
  Companion tests retain their menu-position and focus assertions and exercise
  Retry without losing selected friends.
- Review regressions reproduced unsolicited empty-query loading in both the
  server loader and live controller, area context on the Climbers tab, repeated
  empty-picker instructions, and the extra full-search area field. The same
  assertions pass after the fixes. A stopped preview server was a setup failure
  and does not count as red evidence.
- The logging pagination assertion was checked with a temporary disconnected
  Load more callback. It failed to find the next-page record, then passed after
  restoring the callback, including selection of that record by identity.
- Clearing an applied quick-search area also dismisses its suggestion, so a
  visually identical chip does not immediately return. The regression test
  verifies the chip disappears, the query stays intact, and an outside-area
  result becomes selectable.

Focused integration commands and evidence:

```sh
pnpm exec playwright test tests/ui/search-integration.spec.ts --project desktop-light
pnpm exec playwright test tests/ui/search.spec.ts --grep 'search journey preserves'
pnpm exec vitest run db/queries/climbs.test.ts db/queries/sends.test.ts lib/filters/climb-filter.test.ts
pnpm exec playwright test tests/ui/search-integration.spec.ts --grep 'legacy area-name'
pnpm test -- app/page.test.tsx
pnpm exec playwright test tests/ui/search.spec.ts --grep 'offers area context|blank quick search|full search clears|empty logging picker|one search field'
pnpm exec playwright test tests/ui/search.spec.ts --grep 'logging picker omits|logging picker paginates'
pnpm exec playwright test tests/ui/search.spec.ts --grep 'clearing quick area scope'
```

The UI feedback red runs used the same tests against the persistent gallery on
port 6008 through a temporary Playwright config. The database regression run
temporarily broadened `areaIdCondition`; it was restored before the green run.

Final integration checks:

- `pnpm check`: passed (107 test files, 1,401 unit tests).
- `pnpm exec opennextjs-cloudflare build`: passed.
- `pnpm test:ui`: passed (1,000 checks) before the final review refinements.
  Subsequent affected runs passed: 432 search/navigation checks, 40 logging-picker
  checks, and finally 340 search checks after the scope-chip fix.
- The 16 focused screenshot checks passed after adding explicit waits for ready
  results, so review captures show completed layouts rather than loading states.

Screenshots were inspected at 1024×900 and 375×812 in Paper and Ink, plus 320px
filters/pickers and the short 320×480 quick-search dialog. Representative report
attachments are `full-search-ready`, `quick-search`, `empty-log-picker`,
`search-320-short`, `search-filters-320`, and `search-picker-320`. Long names and
locations truncate within rows while retaining their accessible names. No
remaining blocking layout concerns were found.

Manual verification in the running app confirmed that logging has no area field,
Load more preserves the first 25 records and appends the next 25, and selecting a
climb opens its correct entry form. No journal entries or sends were written.

Logs for this integration are saved under `/tmp/betabook-integration-*` and
`/tmp/betabook-search-*` during local review.

## Original Storybook design-phase verification

Focused red–green runs used:

```sh
pnpm exec playwright test tests/ui/search.spec.ts --project=desktop-light --workers=1
```

The first run had 8 passes and 2 behavior failures: Escape failed to close the
nonempty dialog, and the footer was outside a 320×480 viewport. After fixing the
layout, accessibility checks also caught the non-focusable scroll region and
status/Retry content incorrectly nested inside the listbox. Those issues were
fixed without weakening the assertions. All 19 expanded checks subsequently passed.

Additional focused red commands:

```sh
pnpm exec playwright test tests/ui/search.spec.ts --project=desktop-light --workers=1 --grep 'local area filtering|import picker starts|retry keeps'
pnpm exec playwright test tests/ui/search.spec.ts --project=desktop-light --workers=1 --grep 'changing query clears'
```

The first exposed 3 fixture behavior failures: filtering an area after pagination,
an unseeded import query, and disabling successful sections during Retry. The
second exposed a retained keyboard selection after changing query A → B → A.
The corrected behavior is included in the final search suite. Sandbox port-binding
errors and an incorrect test locator were setup failures, not red evidence.

Final checks:

- `pnpm check`: passed (105 test files, 1,385 unit tests).
- `pnpm test:ui`: passed (924 checks across desktop/mobile and Paper/Ink).
- `pnpm exec playwright test tests/ui/search.spec.ts`: passed (84 checks), including
  added 320px full-filter/picker coverage and the 320×480 quick dialog.
- `pnpm exec opennextjs-cloudflare build`: passed.

Screenshots were reviewed at 1024×900 and 375×812 in both themes, plus 320px
filters/pickers and the short 320×480 modal. Review evidence is attached to the
local Playwright reports; these are visual review artifacts, not pixel baselines.

### Focus styling correction

Mouse/touch opening keeps the search autofocus without showing an outer blue box.
Keyboard navigation retains the theme's focus ring. The inner surface no longer
clips that ring; the modal body still bounds the independently scrolling results.
Pointer focus and Keyboard focus have their own component stories.

The focused command below initially failed both assertions (unexpected ring after
mouse-open and clipped keyboard ring), then passed across all four viewport/theme
projects after the fix. The broader layout and preview density are unchanged.

```sh
pnpm exec playwright test tests/ui/search.spec.ts --grep 'journey preserves the field|opening search with the pointer'
```

## Rebase and search/filter separation

Rebased onto main at `2e660c0`, retaining the date filters, existing-hashtag filters,
and stronger Storybook checks from #171, #174, and #175. Search finds records;
filtering narrows an existing list. Filter UI and domain modules now live under
`components/filters/` and `lib/filters/`, with separate Patterns / Filters stories.
The shared query field and area identity are neutral UI/data primitives. Removed
the old asynchronous SearchCombobox while retaining its hashtag browsing and
protected-prefix behavior in the local HashtagFilter control.

The reviewed navigation regressions were reproduced with
`pnpm exec playwright test tests/ui/search-integration.spec.ts --project desktop-light --grep 'a new quick|another tab'`:
both tests failed on the retained query and missing link href, then all five
integration tests passed after resetting each quick-search session and restoring
native result links. No setup failures are counted as red evidence.

Tutorial decision: retain lesson IDs and version. Record discovery is still
Search; inline list labels now say Filter. Existing date/hashtag behavior remains
as introduced on main, so no new lesson is required for the module reorganization.
The journal demo uses the same `FilterInput` and terminology as the live list.

Validation after rebasing and reorganizing:

- `pnpm db:migrate:local`: no pending migrations.
- `pnpm check`: passed (109 files, 1,423 tests).
- `pnpm test:ui --workers=4`: passed (1,212 checks across desktop/mobile and Paper/Ink).
- `pnpm exec opennextjs-cloudflare build`: passed.
- Refreshed the running gallery on port 6008 and checked the moved inventory links.
  Choosing a fixture area in the Sends toolbar keeps the date and hashtag filters;
  the story makes no live API requests.

The first UI run identified a companion error-story text mismatch and a test that
expected a menu to be open after the story deliberately blurred it. The corrected
story and explicit keyboard-opening step pass with the shared runtime-error guard,
covering both Retry and recovery by editing the query. The filter serializer now
leaves category selection to `searchHref`; its exact serialization assertion was
updated while the full search URL round-trip checks remain intact.

Reviewed fresh screenshots at 1024×900 and 375×812 in both themes, plus 320px
filter/picker layouts and the 320×480 quick dialog. Expanded Sends screenshots
include main's date range and selected hashtag. Local review artifacts are saved
in `search-filter-refactor/` in this task's visualization directory and in the
passing Playwright report. No blocking layout concerns remain.
