This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, set up local secrets, and create the local database:

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm cf-typegen        # generates worker-configuration.d.ts from wrangler.jsonc + .dev.vars
pnpm db:migrate:local
```

Run `pnpm cf-typegen` again whenever you change `wrangler.jsonc` or add a key
to `.dev.vars` — `CloudflareEnv` is derived from both, so a missing key shows
up as a type error on `env.SOMETHING`.

Then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Local environment variables

`next dev` gets its bindings and vars through `@opennextjs/cloudflare`, which
layers `.dev.vars` (gitignored) over the `vars` block in `wrangler.jsonc`.
`.dev.vars` is not optional for auth work: without it `BETTER_AUTH_URL` falls
back to the production `https://betabook.ca`, so verification and
password-reset links generated locally point at the deployed site.

`RESEND_API_KEY` should stay unset locally — `lib/email.ts` then logs
verification and reset links to the `next dev` console instead of sending real
mail.

### Signing in locally

Anonymous browsing needs no setup. To exercise the signed-in surfaces
(`/account`, logging sends, imports), seed a pre-verified user:

```bash
pnpm seed:user                                  # dev@example.com / password
pnpm seed:user me@example.com hunter2 Jasper    # or pick your own
```

Then sign in at [/sign-in](http://localhost:3000/sign-in). Re-running the
command against an existing email resets that user's password and name while
keeping their id — and therefore their sends — so it doubles as a local
password reset.

The script writes to the local D1 database only (`wrangler d1 execute --local`)
and hashes the password with Better Auth's own `hashPassword`, so the stored
credential is byte-for-byte what a real sign-up would have produced.

Signing up through the UI at [/sign-up](http://localhost:3000/sign-up) also
works. Because `lib/auth.ts` sets `requireEmailVerification: true`, you then
have to copy the verification link out of the `next dev` console and open it
before the account can sign in — the seed script exists to skip that step.

## Tests

```bash
pnpm test
```

The suite runs under `@cloudflare/vitest-pool-workers`, which loads the worker
entrypoint named in `wrangler.jsonc` (`.open-next/worker.js`). On a fresh
checkout that file doesn't exist yet and every test file fails to import — run
`pnpm exec opennextjs-cloudflare build` once first.

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
