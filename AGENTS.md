<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Betabook Architecture & Code Layout

Betabook is a climbing logbook application built with Next.js 16 (App Router), React 19, Cloudflare Workers (`@opennextjs/cloudflare`), Cloudflare D1 (SQLite via Drizzle ORM), and Better Auth.

## Directory Layout

```
betabook/
├── actions/            # Next.js Server Actions ("use server")
│   ├── areas.ts        # Area creation, updates, and deletion
│   ├── climbs.ts       # Climb creation, updates, and deletion
│   ├── sends.ts        # Send logging, editing, and deletion
│   ├── import.ts       # Batch send import execution & resolution
│   ├── revalidation.ts # Next.js cache revalidation helpers
│   └── index.ts        # Re-export barrel for server actions
├── app/                # Next.js App Router (pages, layouts, route handlers)
│   ├── (auth pages)    # /sign-in, /sign-up, /forgot-password, /reset-password
│   ├── account/        # User account & /account/import wizard page
│   ├── areas/[id]/     # Area exploration, tree view, and climb listings
│   ├── climbs/[id]/    # Climb details & send history
│   ├── users/[id]/     # User profile, send logbook, and analytics
│   ├── sitemap.ts      # Sharded sitemap (+ sitemap-index.xml route); opengraph-image.tsx
│   └── api/            # Route handlers (auth, feed, search, exports)
├── components/         # React UI Components
│   ├── ui/             # Design tokens & generic primitives (buttons, modals, fields)
│   ├── import/         # CSV import wizard subsystem (steps, drawers, matchers)
│   ├── product-tours/  # Lazy-loaded tutorials and interactive demo previews
│   └── *.tsx           # Domain feature components (areas, climbs, sends, auth)
├── db/                 # Database & Persistence Layer
│   ├── client.ts       # Cloudflare D1 / Drizzle client factory
│   ├── schema.ts       # Drizzle table definitions & relations
│   └── queries/        # Pure read queries (getArea, searchClimbs, getSubareas, etc.)
├── drizzle/            # Database migrations and migration schemas
├── hooks/              # Reusable React hooks (useMounted, useTypeahead, etc.)
├── lib/                # Pure domain logic & utilities (no UI or Action dependencies)
│   ├── grades.ts       # Grade systems, scales (Hueco, YDS, Font), and Discipline types
│   ├── discipline-filter.ts # Multi-discipline filter contracts and parsing
│   ├── sends-import.ts # CSV parsing, column mapping, and value detection
│   ├── import-matching.ts # Candidate matching algorithms for climb imports
│   ├── action-result.ts # Standardized ActionResult & ActionError types
│   ├── session.ts      # Authentication & session validation helpers
│   ├── site.ts         # Canonical origin, site name, OG image constants
│   └── seo.ts          # Pure title / description / JSON-LD builders + pageMetadata()
└── test/               # Test setup, fixtures, and Cloudflare Worker test pool
```

## Architectural Boundaries & Layering

Strict boundaries are codified in `oxlint.config.ts` via `typescript/no-restricted-imports` and enforced automatically in CI:

1. **Server Actions (`actions/`)**:
   - Contain `"use server"` handlers for all user mutations.
   - Handle form input validation, session checks (`requireSession()`), D1 database writes, and Next.js cache revalidation (`revalidatePath()`).
   - Must return structured `Promise<ActionResult>`.
   - **Restriction**: Must never import from `components/**` or `app/**`.

2. **Components (`components/`)**:
   - Client components (`"use client"`) invoke Server Actions via `@/actions`.
   - **Restriction**: Forbidden from importing `@/db/client`, `@/db/queries`, or `@/db/schema` at runtime. Data reads happen via server components / page loaders, and writes happen via Server Actions. Type-only imports (e.g. `import type { Area } from "@/db/queries"`) are permitted.
   - **UI Primitives (`components/ui/`)**: Generic primitives and design tokens must never import from other components (`@/components/**` outside `components/ui/`).

3. **Domain Logic (`lib/`)**:
   - Pure domain logic, validation, formatters, and mathematical utilities.
   - **Restriction**: Must never import from `components/**`, `app/**`, or `actions/**`.

4. **Persistence Layer (`db/`)**:
   - Contains D1 client initialization, schema definitions, and read-only query functions.
   - **Restriction**: Must never import from `components/**`, `app/**`, or `actions/**`.

5. **Import Safety Suite**:
   - Oxlint enforces cycle-free (`import/no-cycle`), duplicate-free (`import/no-duplicates`), and relative-parent-free (`import/no-relative-parent-imports`) imports across all modules.

## Product Tutorials

For each new user-facing feature or workflow change, decide whether to update a tutorial, add a step, create a separate tour, or leave tutorials unchanged. Note the choice and why in the plan or PR. New sections and changes to logging or privacy often need an explanation; internal changes and obvious controls may not. Update any existing tutorial that becomes inaccurate.

Read [docs/product-tours.md](docs/product-tours.md) before changing a tutorial.

- Add related steps in `lib/product-tour-navigation.ts` with a stable ID, section, title, short description, and `data-tour-target`. Add the target to the page component and reuse the app's layouts and display components for demo views. For a separate feature tour, register metadata in `lib/product-tour.ts`, its steps in `PRODUCT_TOUR_STEPS`, and a lazy page loader in `components/product-tours/registry.ts`. `/tutorial/[tourId]/[stepId]` handles navigation, callout positioning, keyboard focus, progress, and replay. Keep each callout to one short explanation; do not rebuild the tour as a drawer or repeat instructions inside the example.
- Use the sample climber in `lib/product-tour-demo.ts`. Reuse display components and calculations from the app, and keep the examples consistent across pages. Demo controls use local state. Never save sample data or use demo IDs in real links or writes.
- Decide whether people who dismissed or finished the tour should see it again. If so, bump its version. Copy edits usually don't need this. A new tour ID tracks progress separately.
- Keep the guide in its own space beside or below the scrollable demo. Never cover controls or results with tutorial text, or dim content people need to read. Check navigation, replay, keyboard focus, mobile layout, and the example controls. Update tests for changed behavior and sample data, and check that demos don't change the user's account.

## SEO & Metadata

`robots.txt` is managed at Cloudflare (not in-repo). LLM/AI crawlers are blocked there; Google/Bing indexing is controlled **per page** in code. When adding a route under `app/`, decide up front whether it should be indexable:

- **Indexable** (an entity page, a landing/marketing page): export `generateMetadata` returning `pageMetadata({ title, description, path, ogType? })` from `@/lib/seo`. It sets the per-page title, a synthesized `description`, a self-referential canonical, and a **complete** `openGraph`/`twitter` block — Next _overwrites_ (not merges) those objects, so never hand-roll a partial one. Compose the title/description strings with the builders in `@/lib/seo` (e.g. `climbTitle`, `areaDescription`).
- **Not indexable** (auth pages, `*/new` forms, anything session-gated, `users/[id]` + `users/[id]/analytics`): add `robots: { index: false }` to the page's `metadata`/`generateMetadata`. For an otherwise-indexable page whose query params spawn infinite filter/search states, `noindex` when any param is present (see `app/page.tsx`).
- **Entity detail pages** (climb, area, and future equivalents): also render `<JsonLd data={…} />` (`@/components/ui/json-ld`) with at least a `BreadcrumbList`. JSON-LD builders live in `@/lib/seo`; don't emit `AggregateRating`/`Review` markup (manual-action risk for types Google doesn't support).
- **A new crawlable entity type** must be added to `app/sitemap.ts` as a shard, backed by `countX` + `getXIdsPage` queries in `db/queries`. The submittable sitemap URL is `app/sitemap-index.xml` — Next emits the numbered shards but no index. API/JSON routes get `X-Robots-Tag: noindex` via `next.config.ts` `headers()`.

Site identity constants (canonical origin, name, OG image) live in `@/lib/site`. `lib/seo.ts` is pure and unit-tested (`lib/seo.test.ts`) — extend the tests when you add builders.

## Validation Commands

Before committing, run the full validation suite:

```bash
pnpm check         # Runs lint, format:check, deadcode, typecheck, and vitest
pnpm lint          # Oxlint with type-aware analysis and import boundaries
pnpm format        # Oxfmt code and import auto-formatter
pnpm deadcode      # Knip dead code and unused export detection
pnpm deadcode:prod # Knip minus dev entrypoints: exports kept alive only by tests
pnpm typecheck     # Next.js route typegen + tsc --noEmit
pnpm test          # Vitest test suite via Cloudflare Workers pool
```
