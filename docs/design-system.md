# Betabook design system

Betabook should feel like a calm, practical climbing logbook. Its identity comes
from the paper/ink palette, condensed titles, readable climbing data, and direct
language. Use existing patterns before adding a new visual treatment.

## Start here

```sh
pnpm storybook             # http://127.0.0.1:6006
pnpm exec playwright install chromium  # once per browser-version upgrade
pnpm test:ui               # gallery plus real app branding/metadata checks
```

Storybook is a development tool, separate from the deployed Next.js application.
It needs no D1 database, environment file, account, or external service. The
Paper/Ink toolbar changes the real application theme on the entire document,
including portalled dialogs. Resize the browser to inspect narrow layouts.

Read the adjacent `*.stories.tsx` under [components](../components) before changing a shared
component. Start at **Internal / Coverage / Inventory** to find its story. The stories import production components
and [app/globals.css](../app/globals.css), not copies of their markup or colors.
The small [font adapter](../.storybook/fonts.css) serves the same local font files
as `app/layout.tsx`; update both if the application font loading changes.

## Sources of truth

### Brand identity

The Foundations story includes the complete mountain-to-checkmark logo, coral
sun, lowercase **betabook** wordmark, and **CLIMB · LOG · PROGRESS** tagline in
light and dark treatments. Use the full composition where space permits. For
site icons and compact placements, use the square `betabook-icon-light.svg` or
`betabook-icon-dark.svg`: the same mountain, tapered checkmark, and sun with no
lettering. At 16–32px, use the `betabook-icon-small-*` optical variants, with
stronger strokes and a taller silhouette. Foundations shows actual-size browser
tabs, compact headers, and app tiles. Never squeeze
the full wordmark into an icon or substitute a generic mountain.

The reference assets live in [assets/branding](../assets/branding/README.md).
The artwork is transparent: light and dark reference panels use the theme's
`bg-background` (paper and ink) rather than introducing separate background
colors. Lettering follows ink/paper, with coral reserved for the sun. Production navigation and the home-screen helper reuse `components/brand.tsx`.
The header pairs the original mark with the approved wordmark at 640px and wider;
narrower screens keep a 48px icon-only home link. About and social previews preserve
the full lockup and tagline. The global palette is unchanged.

Transactional emails use `lib/email-template.ts` and the complete About-page
logo: mountain, sun, wordmark, and tagline. The generator exports that same artwork
to `public/branding/betabook-lockup-email.png` at 1000 × 640 on a paper canvas.
Display it centered at up to 350px wide, shrinking proportionally on narrow screens.
PNG works across inbox apps where SVG
support varies. Email documents use inline ink/paper/primary colors, Arial/Helvetica
fallback fonts, and a table layout because they cannot load the app's Tailwind
theme or bundled fonts. Keep these literal colors aligned with the palette.
The paper-backed logo remains legible when inbox apps recolor surrounding content;
the gallery does not simulate every client's dark-mode transformations.
Inspect **Patterns / Email** for auth, welcome, friend request, contact, and
moderation examples, including long links and literal visitor input. Every email
also carries plain text, and its message and links remain usable with images blocked.
The welcome email shows labeled buttons without duplicate visible URLs underneath;
its plain-text alternative retains every destination. Other emails keep their
copyable URLs below the buttons.
Tutorials stay unchanged: this changes email presentation without changing a workflow.

| Concern                     | Source                                   | Rule                                                                                                                                                            |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors and theme roles      | `app/globals.css`                        | Use semantic utilities such as `bg-surface` and `text-muted`. New colors belong in the theme, not feature markup.                                               |
| Panel surfaces and padding  | `components/ui/card.ts`                  | Use `cardClass` for ordinary panels. Compact panels have 16px padding; standard panels have 24px. Both use the shared 12px `rounded-panel` token and no shadow. |
| Titles and section headings | `components/ui/typography.tsx`           | Use `PageTitle` and `SectionHeading`; avoid local font/size overrides.                                                                                          |
| Climb and activity rows     | `components/ui/list-row.tsx`             | Square internal rows, separators, stable alignment, and room for grades even with long names.                                                                   |
| Form fields                 | HeroUI and `components/ui/field.ts`      | Native controls use `FIELD_CLASS`; preserve matching geometry and visible keyboard focus.                                                                       |
| Grades and category labels  | `Grade`, `DisciplineChip`, `AscentStyle` | Reuse the labels and colors. Grades stay in Geist; categories remain identifiable without color.                                                                |
| Empty/loading states        | `EmptyState`, `Skeleton`                 | Match the eventual content and keep the next action clear.                                                                                                      |
| Delete confirmation         | `ConfirmDeleteDialog`                    | Preserve focus return and keyboard-accessible Cancel/confirmation. Alert dialogs intentionally do not dismiss on Escape.                                        |

Use Barlow Condensed for page titles and Geist for reading, controls, and grades.
The logo uses Barlow Condensed Bold for its lowercase wordmark and Geist Medium
for its tagline. The header uses the approved lowercase wordmark, cropped by the asset generator
without changing its lettering.
The current stat tiles and avatar initials are explicit
display-type exceptions. Keep labels in sentence case and use concrete language
such as “Log session” and “No sends yet.”

Reading copy is 16px; supporting text, labels, control values and feedback are
normally 14px. Compact field descriptions and metadata are 12px. Use HeroUI
`Label`, `Description` and `FieldError` to associate feedback with its control;
announce dynamic errors and retain semantic invalid/focus treatments.

Every sortable list uses `SortSelect`: show “Sort by” as a 12px muted label
above the dropdown on all screen sizes, with the direction button aligned beside
the field. Toolbar rows bottom-align their controls so the search and sort boxes
line up while the sort label sits above them. See **Components / Inputs / Sort select** for name, grade, and Sends
examples. Tutorials remain unchanged because sorting behavior is unchanged.

Use `FIELD_HEIGHT_CLASS` for search and sort boxes: 40px on mobile and 36px
on larger screens, plus the current theme border on both edges. Journal search,
shared search and filter inputs, sort dropdowns, and direction buttons share this recipe.

Use `FIELD_ACTION_CLASS` to match an adjacent action to its field's responsive
size and theme border width. Keep compact row/menu actions small. Pending
buttons should prevent repeat requests while retaining keyboard focus.

In the journal form, put “I sent” before the date controls. For a climb without a
recorded send, keep “I don't remember the date” visible and disabled until “I sent”
is selected, with an associated explanation. Explain that undated sends stay in
Sends until a date places them in the journal; sessions, repeats, and training need
a date. Switching back to a session clears the unknown-date choice and restores
the entered date. See **Components / Journal / Entry date** for these states.
Tutorials remain unchanged: the Log lesson describes entry types and does not
demonstrate the date controls; its instructions remain accurate.

Cards and bounded content panels use `rounded-panel`, backed by the unchanged
`--radius-panel: 0.75rem` (12px) token. Choose a treatment by purpose with
`cardClass(padding, surface)`; the default remains `cardClass("md", "quiet")`.

| Treatment  | Purpose                                                                                                                 | Fill                      | Boundary / elevation                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------- |
| `quiet`    | Forms, settings, stats, expanded filters, journal choice summaries and tutorial status                                  | `surface-secondary`       | No border or shadow                 |
| `bordered` | Feed days, selectable entry cards and the in-flow tutorial guide                                                        | `surface`                 | One `border-border`, no shadow      |
| `inset`    | Supporting content inside another panel: journal form summaries, import selections/file details and helper instructions | Opaque `surface-tertiary` | No additional border or shadow      |
| `floating` | Fixed mobile installation helper                                                                                        | `overlay`                 | One `border-border` and `shadow-lg` |

Use `sm` (16px) for compact cards, including summaries and nested content;
`md` (24px) for forms/settings; `fluid` (16px below 640px, 24px above) for wide
content. Use `none` only for flush lists whose headers and rows own their spacing.
Feed headers use 16px, while internal rows keep their existing 16px horizontal /
12px vertical density and `separator` dividers. Outer bounded panels use `border`,
not the weaker row separator. Do not stack translucent fills, rings, borders and
shadows to distinguish ordinary content. Nested content needs one grouping layer.

### Surface audit and retained exceptions

The surface follow-up to #149 keeps existing quiet auth/entity forms, account
settings, analytics, statistics and filters. It migrates feed cards and tutorial
feed previews to the same bounded treatment; journal summaries to compact spacing;
journal form summaries, import selections/file details and helper instructions to insets; selectable entry
cards to bounded content; and tutorial status/guide panels to
quiet/bordered recipes. The helper keeps floating elevation with one border.
Feed loading now mirrors day cards, and account danger loading shares the real
section's `DANGER_CARD_CLASS`.

These purpose-specific exceptions remain:

- Empty states and CSV upload targets: transparent, dashed `border-border`,
  24px horizontal / 40px vertical padding to invite content. Upload hover/drag
  feedback remains interactive, including its accent border.
- Danger zone: `DANGER_CARD_CLASS` preserves the red semantic fill/border and
  24px padding in both loaded and loading states.
- HeroUI dialogs, menus and popovers retain their library overlay treatment;
  the small histogram tooltip keeps its compact border/shadow. The tutorial
  guide is in normal flow, so it uses `bordered`, not floating elevation.
- Tutorial demo viewport: transparent 8px inset for spotlight clearance;
  spotlight dimming and outline are focus treatments, not content surfaces.
- Nested import candidate lists keep a transparent, bordered frame so the
  selected row’s `surface` fill remains distinct. Their compact controls retain
  12px horizontal / 8px vertical padding.
- Internal list rows, sticky journal date headers, controls, chart marks and
  avatar/icon treatments retain their density and interaction geometry.

Tutorial previews and framing follow the real surfaces. Lesson copy, navigation,
IDs and versions are unchanged because the logging/sharing workflows are unchanged.

Ordinary page sections can sit directly on the background, and internal list rows
stay square. Controls (including the segmented search switch), HeroUI dialogs and
popovers retain their control/overlay geometry. Pills, avatars, and progress bars
may be fully rounded; tiny chart/calendar marks keep their small radii for
legibility. The home-screen icon tile and tutorial spotlight outline are icon and
focus treatments, not cards. Do not use these exceptions for a new content panel.

## Gallery map and coverage

| Section                       | What to inspect                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foundations / Brand and style | Full logo and compact icon on paper/ink, surfaces, climbing labels                                           |
| Foundations / Tokens          | Live palette and semantic roles, typography, geometry, fields, spacing and motion                            |
| Components                    | Individual input, navigation, layout, data display, feedback, account, journal, import and chart components  |
| Patterns                      | Control comparisons, climbing data, panel compositions, forms, send details, navigation and profile overview |
| Internal / Coverage           | Every production component module, with an example link or an explicit remaining gap                         |

### File organization

```text
components/search/search-selection-field.tsx
components/search/search-selection-field.stories.tsx
components/privacy-fields.tsx
components/privacy-fields.stories.tsx
stories/foundations/    # brand and live token documentation
stories/patterns/       # compositions using multiple components
stories/internal/      # coverage and maintenance views
stories/fixtures/      # shared story-only layouts and deterministic data
```

Use one CSF file per component module, beside its implementation. Set
`meta.component` to that module's actual component, and group closely related
exports in the same file when appropriate. Prefer typed args for isolated states;
stateful examples may manage their own props locally. Keep comparisons in
Patterns, where they explain how components work together. CSS class helpers
(card, field, layout, choice pill) remain documented through tokens/patterns;
they do not need pretend component APIs. Feature modules currently exercised
only inside compositions remain linked to those patterns in the inventory.

Use explicit sidebar titles (`Components/Search/Selection field`, for example),
so moving files need not rename story URLs. Preserve titles and export names
because published links and agent references depend on them; update coverage
links and browser checks when a deliberate rename is needed.

Storybook discovers both `components/**/*.stories.tsx` and
`stories/**/*.stories.tsx`. Story files are excluded from the production component
inventory and the production dead-code audit. Production modules must never
import story files or fixtures. Change a component and its adjacent examples in
the same change; agents find this convention through `AGENTS.md`.

Every visual shared module in `components/ui` has an example. JSON-LD is
nonvisual. This is broad component coverage, not exhaustive application workflow
coverage: authenticated pages, mutation drawers, moderation, and the complete
import/journal workflows still need fixtures at their service boundaries. The
inventory is generated from the source directory when Storybook starts/builds;
new files appear as gaps until their examples are linked in
[coverage-reference.tsx](../stories/internal/coverage-reference.tsx). Restart the dev server
after adding files. An example link is not a claim to cover every export or state.

Token names are discovered from the application's CSS; swatches and displayed
values use the browser's computed styles, including theme changes. HeroUI's
inherited field/action roles are cataloged separately. The gallery does not own
a second palette. Change `app/globals.css` to change the application and the
reference together. Spacing and geometry show live measurements; animation
recipes come from the same CSS source. Raw palette swatches are not a guarantee
that a color works as text: inspect real foreground/fill pairs and run contrast
checks on the components using them.

The radius cleanup for issue #149 consolidates ordinary card/panel radii from
8px, 12px, and 16px to 12px. Surface treatments and spacing are standardized above.

Keep fixtures deterministic and interactions local. Do not import live server
actions, database services, authenticated providers, or real account data.
Simulate effects only at external boundaries, retaining the production component.

Each example must document a distinct state, composition, or design decision.
Prefer an existing component story to another composition containing the same
examples. Sample actions need observable local outcomes; label inert button
specimens as visual treatments. Error stories must reach the actual error state,
and form stories should expose submitted values at the save boundary instead of
inventing a success sentence that hides lost or incorrect data.

## Search and filters

Search finds a record to open or select. Filters narrow a collection already on
screen. Keep this distinction in module names, props, tests, stories, and labels:

| Concern                           | Ownership                                                                                   | Examples                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Record search                     | `components/search/`, `hooks/use-search.ts`, `hooks/use-search-lookup.ts`, `lib/search*.ts` | Quick search, full results, climb/area/companion selection                            |
| List filtering                    | `components/filters/`, `lib/filters/`, `hooks/use-filter-form-navigation.ts`                | Area climbs, Journal text/date/hashtags, Sends, Analytics hashtags, climb refinements |
| Shared field chrome               | `components/ui/query-input.tsx`                                                             | `SearchInput` and `FilterInput` retain distinct meanings with the same styling        |
| Shared identities and URL parsing | `lib/area-selection.ts`, `lib/url-params.ts`                                                | Bound area IDs, URLSearchParams parsing, pagination bounds                            |

`FilterToolbar.textFilter` is an inline list filter, never a suggestion menu.
`ClimbFilterControls` accepts filter state rather than search query/category state.
The hashtag picker browses existing supplied values locally; it does not call
record-search endpoints. Searching for an area to use as a filter still uses
`AreaLookup`, since that interaction selects a record identity. Native names such
as `URLSearchParams` and Next.js `useSearchParams` refer to URL APIs, not the
product's Search feature, and remain unchanged.

Storybook separates **Patterns / Search** from **Patterns / Filters**, with
reusable filter controls under **Components / Filters**. Keep query strings and
API routes compatible while reorganizing internal modules.

Quick search, full results, local list filters, and workflow pickers share the
search and filter components in their respective folders. Quick search opens from the
header or the platform search shortcut. All / Climbs / Areas / Climbers is the
shared category vocabulary. The current area is an explicit suggestion, never
an implicit scope, and is offered only in All or Climbs. Climbers are global.
Search waits for a nonempty name in every category, including the homepage and
climb picker. Clearing the name returns to the initial prompt without fetching
unfiltered records. The empty logging picker has one short prompt, with no
results heading or repeated selection instruction.

The header has one Search button with the platform shortcut; there is no
duplicate Search navigation link. Full search has one name field and no separate
area lookup. Logging and merge pickers also omit that field. Import matching
retains an area lookup for resolving its imported location. Climb picker results
load 25 at a time; Load more appends the next page. Enter opens an explicitly
selected ready result; otherwise
it expands to full results. Escape closes the dialog and restores focus.

The full-results URL preserves query, category, area ID, sort, and filters.
Category changes reset category-specific refinements. Query edits replace the
current history entry; category and area choices create history entries. Area
scope includes the selected area's descendants and distinguishes duplicate
names by identity. Existing area-name URLs remain readable, while new choices
write area IDs. Scopes carried from quick search remain visible and removable
on the full page; legacy area-name filters also have an explicit clear action.

Area climbs, Sends, and Journal use `FilterInput` to filter their list directly without a second
results menu. Area selection and companion lookup use `SearchSelectionField`;
free text cannot bind an identity. Logging allows repeats, import search seeds
text until an area is selected, and merge selection disables the source climb.

`SearchInput`, `SearchCategories`, `SearchResults`, `SearchSelectionField`,
`SearchSurface` and `SearchPicker` remain controlled display
components without router, auth, database, or action imports. `SearchController`
and the app adapters supply transport, URL state, and real navigation. The
production hooks own debounce, cancellation, per-category Retry, pagination,
and stale-result protection. Quick search starts fresh on reopening, and full-result navigation uses native links so modified clicks keep working. Storybook replaces network and navigation
boundaries with deterministic fixtures; fixture IDs never enter app routes or
writes.

The Patterns / Search journeys and app picker stories exercise those production
controllers. Named loading, empty, failed, and selected examples also document
presentation states. The discovery tutorial uses the same controller with local
sample transport and friend-request actions. Its stable lesson IDs and version
remain unchanged because the current version 2 update is unreleased.

## Preventing regressions

`pnpm test:ui` discovers all stories from the built Storybook index and runs
Chromium at desktop and mobile widths in both themes. The same command also runs
real app branding checks against Next.js, covering navigation, About,
theme persistence, and favicon/touch/manifest/social assets. Playwright starts the
gallery preview and the app, applying local D1 migrations before starting a new
app server. It defaults to port 3000, matching `pnpm dev`; set `BETABOOK_UI_PORT`
to the port of an existing app when it differs (for example,
`BETABOOK_UI_PORT=3003 pnpm test:ui`). Both the server and tests use that port,
and server readiness warms the homepage compilation before navigation checks.
It can reuse an existing app; stop and migrate that app
first if its database is out of date. Use the normal local `.dev.vars` setup;
CI copies `.dev.vars.example` and needs no seed or account for these checks.
Both suites share the same HTML report and four viewport/theme projects.
New stories automatically
receive accessibility, overflow and screenshot checks. Focused interaction tests
check rendered panel geometry (including feed, empty, mobile-helper, and loading
components, with a live token-change check), surface roles/borders, nested and
responsive padding, feed loading structure, typography, native/HeroUI field consistency,
keyboard focus, dialog cancellation/confirmation, live token updates, search
selection, menus, comment expansion, and tag editing. The gallery-wide checks
cover horizontal overflow and automated WCAG A/AA findings. Tests inspect browser behavior and computed styles,
not source-text patterns. Keep the Workers/D1 test suite separate.

All UI specs use `tests/ui/story.ts`. Its `openStory` helper verifies the project
theme, fixes the browser date, waits for Storybook's render/play completion and
settles fonts/finite animations. The preview lifecycle sets the readiness signal;
do not replace it with a timeout or a story heading alone. Unhandled browser
errors and live API requests from a story fail the suite. Axe checks the complete
story document, including open portals, with WCAG 2.0/2.1 A/AA rules.

Email previews retain their scriptless iframe sandbox. Because that sandbox also
blocks axe's asynchronous rule callbacks, the gallery audit checks the iframe
element and audits its actual email HTML in a separate page at the same frame
dimensions. Both use the full WCAG A/AA rules. Screenshots and interaction checks
still exercise the sandboxed preview; a focused test verifies document, contrast,
image, and link rules actually ran inside the email content.

The CI **UI reference** job runs on every PR and main-branch push and is a
deployment prerequisite. It uploads an HTML report with screenshots and failure
traces. These Playwright screenshots are review evidence, not pixel-comparison baselines.
The separate [publishing workflow](../.github/workflows/chromatic.yml) hosts the
gallery and Storybook documentation MCP on Chromatic. UI Tests and UI Review are
disabled there, and the preview disables snapshots. Publishing incurs no snapshot
usage. There is no automatic pixel comparison; review the Playwright screenshots
and rely on the rendered geometry, accessibility, and interaction assertions for CI checks.
The suite cannot detect every visual change or assess complete accessibility;
inspect affected stories and real application screens before completing UI work.
Repository branch protection must also require this job if merges should be
blocked; a workflow alone does not configure GitHub merge rules.

For a deliberate design change, update the primitive/token, the example, this
guide, and relevant assertions together. Explain the intended before/after in
the PR. Do not blindly accept new expected values or disable accessibility
rules. When adding coverage for existing behavior, temporarily introduce a
targeted regression, observe the expected failure, restore production code, and
record both failing and passing commands.

Agents discover this guide through the root `AGENTS.md`. That file requires
reading the relevant stories and running the UI checks; the executable checks
provide enforcement when instructions are missed. Keep the root link in place.

Tutorial decision: no lesson steps or versions change. Tutorial demo cards, status panels, and guide framing use the shared panel radius, matching the application without changing navigation, targets, or lesson content. Storybook folder organization only changes developer documentation and discovery. The privacy contrast correction,
secondary-button token adjustment, keyboard-scrollable progression charts, and progress-bar labels improve shared
presentation/accessibility without changing any workflow. Tutorial previews
automatically inherit the shared fixes. Future primitive changes should also be checked
in the tutorial previews, which reuse application components.

Sends and Journal share `DateFilter`, labeled Dates, inside the collapsed
More filters panel. Keep the More filters trigger directly after the view or
discipline tags in the same wrapping group; sorting is a separate control.
Both keep the applied day or date range visible in a separate,
left-aligned chip row below the toolbar controls
using the same date chip and a muted X to clear it, even when the panel is closed.
The toolbar previews simulate navigation locally, so clicking X removes the chip
and resets Dates to All time, just as on the app pages.
The X matches the selected hashtag chip pattern; the link retains its accessible
“Clear date filter” label. The options are All time (default),
This month, This year, Last year, and Custom dates. Presets apply immediately using
the viewer's local calendar date and store concrete inclusive bounds in the URL.
Custom dates reveal Start date and End date fields using `DatePickerField`, with
both keyboard entry and calendar popovers. Custom edits update automatically through
the toolbar's existing debounce
when a start date is complete and any end date is on or after it.
Incomplete or reversed dates preserve the last valid filter. A start date
alone selects one day. Field descriptions explain this; Clear end date returns
a range to one day. Selecting
All time clears the constraint. Selecting dates in Journal replaces its year filter.
See **Components / Filters / Date filter** for default, preset, single-day, and
summer 2025 examples. This replaces the mode selector and always-visible calendar.
Existing tutorial guidance on notes, entry types, tags, and Sends sorting remains
accurate, so lesson steps and versions are unchanged.
