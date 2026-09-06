# Betabook design system

Betabook should feel like a calm, practical climbing logbook. Its identity comes
from the paper/ink palette, condensed titles, readable climbing data, and direct
language. Use existing patterns before adding a new visual treatment.

## Start here

```sh
pnpm storybook             # http://127.0.0.1:6006
pnpm exec playwright install chromium  # once per browser-version upgrade
pnpm test:ui               # build the gallery, then run browser checks
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
colors. Lettering follows ink/paper, with coral reserved for the sun. This
addition does not change the site's navigation logo or global palette.

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
for its tagline. The existing application header still uses the previous
uppercase composition until the logo migration.
The current stat tiles and avatar initials are explicit
display-type exceptions. Keep labels in sentence case and use concrete language
such as “Log session” and “No sends yet.”

Cards and bounded content panels use `rounded-panel`, backed by the single
`--radius-panel: 0.75rem` token in `app/globals.css`. Use `cardClass` for the standard
fill/padding; use the same radius utility directly for bordered feed cards,
empty states, upload areas, journal summaries, selectable cards, tutorial panels,
and the mobile installation helper. Panel-shaped loading placeholders use it too.
Surface colors, borders, padding, and floating-panel elevation remain specific to
their purpose; they do not justify a different card radius.

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
components/ui/search-combobox.tsx
components/ui/search-combobox.stories.tsx
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

Use explicit sidebar titles (`Components/Inputs/Search combobox`, for example),
so moving files need not rename story URLs. Preserve titles and export names
once Chromatic baselines exist, or treat renaming as a deliberate baseline
migration. This initial organization changes IDs before the first publish;
coverage links and browser checks use the new IDs.

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
8px, 12px, and 16px to 12px. Broader surface/color alignment and production brand
asset migration remain separate follow-ups.

Keep fixtures deterministic and interactions local. Do not import live server
actions, database services, authenticated providers, or real account data.
Simulate effects only at external boundaries, retaining the production component.

## Preventing regressions

`pnpm test:ui` discovers all stories from the built Storybook index and runs
Chromium at desktop and mobile widths in both themes. New stories automatically
receive accessibility, overflow and screenshot checks. Focused interaction tests
check rendered panel geometry (including feed, empty, mobile-helper, and loading
components, with a live token-change check), typography, native/HeroUI field consistency,
keyboard focus, dialog cancellation/confirmation, live token updates, search
selection, menus, comment expansion, and tag editing. The gallery-wide checks
cover horizontal overflow and automated WCAG A/AA findings. Tests inspect browser behavior and computed styles,
not source-text patterns. Keep the Workers/D1 test suite separate.

The CI **UI reference** job runs on every PR and main-branch push and is a
deployment prerequisite. It uploads an HTML report with screenshots and failure
traces. These Playwright screenshots are review evidence, not pixel-comparison baselines.
The separate [Chromatic workflow](../.github/workflows/chromatic.yml) supplies reviewed pixel baselines
for both themes and viewports, and publishes the Storybook documentation MCP.
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
