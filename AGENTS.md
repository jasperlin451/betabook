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
│   └── api/            # Route handlers (auth, feed, search, exports)
├── components/         # React UI Components
│   ├── ui/             # Design tokens & generic primitives (buttons, modals, fields)
│   ├── import/         # CSV import wizard subsystem (steps, drawers, matchers)
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
│   └── session.ts      # Authentication & session validation helpers
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

3. **Domain Logic (`lib/`)**:
   - Pure domain logic, validation, formatters, and mathematical utilities.
   - **Restriction**: Must never import from `components/**`, `app/**`, or `actions/**`.

4. **Persistence Layer (`db/`)**:
   - Contains D1 client initialization, schema definitions, and read-only query functions.
   - **Restriction**: Must never import from `components/**`, `app/**`, or `actions/**`.

5. **Import Safety Suite**:
   - Oxlint enforces cycle-free (`import/no-cycle`), duplicate-free (`import/no-duplicates`), and relative-parent-free (`import/no-relative-parent-imports`) imports across all modules.

## Validation Commands

Before committing, run the full validation suite:

```bash
pnpm check      # Runs lint, format:check, deadcode, typecheck, and vitest
pnpm lint       # Oxlint with type-aware analysis and import boundaries
pnpm format     # Oxfmt code and import auto-formatter
pnpm deadcode   # Knip dead code and unused export detection
pnpm typecheck  # Next.js route typegen + tsc --noEmit
pnpm test       # Vitest test suite via Cloudflare Workers pool
```
