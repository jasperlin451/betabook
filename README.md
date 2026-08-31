This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, set up local secrets, and create the local database:

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm cf-typegen        # optional: audit the full generated Workers type surface
pnpm db:migrate:local
```

Keep the small, checked-in `cloudflare-env.d.ts` binding contract in sync when
changing `wrangler.jsonc` or adding an application environment variable.

Then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Local environment variables

`@opennextjs/cloudflare` layers `.dev.vars` (gitignored) over the `vars` block
in `wrangler.jsonc`. `.dev.vars` is not optional for auth work: without it
`BETTER_AUTH_URL` falls back to the production `https://betabook.ca`, so
verification and password-reset links generated locally point at the deployed
site. See `.dev.vars.example` for the keys.

### Signing in locally

Anonymous browsing needs no setup. To exercise the signed-in surfaces
(`/account`, logging sends, imports), seed a pre-verified user:

```bash
pnpm seed:user                                  # dev@example.com / password
pnpm seed:user me@example.com hunter2 Jasper    # or pick your own
```

Then sign in at [/sign-in](http://localhost:3000/sign-in). Re-running against
an existing email resets that user's password and name but keeps their id, and
so their sends. Emails are lowercased — better-auth lowercases them on lookup,
but `user.email` is unique under a case-sensitive collation, so a row stored
with capitals could never be signed into.

Restart `pnpm dev` after seeding. The dev server holds its D1 handle open and
won't see rows written by a separate `wrangler` process.

Signing up at [/sign-up](http://localhost:3000/sign-up) works too, but
`lib/auth.ts` sets `requireEmailVerification: true`, so you then have to open
the verification link that `lib/email.ts` logs to the `next dev` console.

## Tests

```bash
pnpm test
```

The test pool uses `test/worker.ts`, so tests run on a fresh checkout without
first generating the production `.open-next` worker bundle.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

Deployed to Cloudflare Workers via `@opennextjs/cloudflare`:

```bash
pnpm preview   # build and run the Workers bundle locally
pnpm deploy    # build and deploy
```

Merging to `main` does the same thing automatically
(`.github/workflows/deploy.yml`): lint, build, apply D1 migrations, deploy.
Migrations run before the worker does, so the live worker briefly sees the new
schema — keep each one backward-compatible. `workflow_dispatch` re-runs a
deploy without a commit, and `pnpm exec wrangler rollback` reverts one.

The workflow needs two repository secrets, `CLOUDFLARE_API_TOKEN` (scoped to
Workers Scripts:Edit and D1:Edit) and `CLOUDFLARE_ACCOUNT_ID`. Runtime secrets
like `BETTER_AUTH_SECRET` and `RESEND_API_KEY` stay Worker secrets set with
`wrangler secret put`; deploying does not touch them.
