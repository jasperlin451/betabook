# Cloudflare infrastructure

OpenTofu configuration for the `betabook.ca` zone, its DNS records, Email Routing, managed robots.txt, and the D1 database. Spacelift plans pull requests that touch this directory and applies merges to `main`.

## Ownership

| This stack                                               | `wrangler.jsonc` and `deploy.yml`                        |
| -------------------------------------------------------- | -------------------------------------------------------- |
| Zone and managed robots.txt                              | Worker code, versions, and deployments                   |
| DNS records other than the apex                          | Bindings (`DB`, `ASSETS`, rate limiters) and `vars`      |
| Email Routing and the `hello@betabook.ca` rule           | Observability settings                                   |
| The `betabook-db` database (create, rename, replication) | The `betabook.ca` custom domain and its apex records     |
|                                                          | Worker secrets (`wrangler secret put`) and D1 migrations |

Do not add `cloudflare_worker`, `cloudflare_workers_custom_domain`, or `cloudflare_workers_route` for the Betabook Worker. `wrangler deploy` rewrites the Worker's settings, routes, and custom domains on every deploy, so the two tools would undo each other.

Once a resource is managed here, dashboard edits to it are drift that the next apply reverts. Change it in a pull request instead.

## Spacelift stack

- Repository `betabook-ca/betabook`, branch `main`, project root `infra/cloudflare`
- Workflow tool OpenTofu 1.12 with Spacelift-managed state
- Protect from deletion enabled; autodeploy disabled until the imports are applied
- Environment, attached through a context:
  - `CLOUDFLARE_API_TOKEN` (secret)
  - `TF_VAR_account_id`
  - `TF_VAR_hello_forward_to` (secret): the inbox that `hello@betabook.ca` forwards to

Do not make the Spacelift check a required status check. It reports only on pull requests that touch this directory, so other pull requests would never become mergeable.

## API token

Create a custom token for Spacelift, separate from the GitHub Actions deploy token, scoped to the Betabook account and the `betabook.ca` zone:

| Scope   | Permission          | Level |
| ------- | ------------------- | ----- |
| Account | D1                  | Edit  |
| Zone    | Zone                | Edit  |
| Zone    | Zone Settings       | Edit  |
| Zone    | DNS                 | Edit  |
| Zone    | Bot Management      | Edit  |
| Zone    | Email Routing Rules | Edit  |

## Adopting the existing resources

Everything here already existed before the stack, so [`imports.tf`](imports.tf) looks up live IDs and imports each resource instead of creating it.

1. Open a pull request. The Spacelift plan should list only imports, with nothing to add or destroy.
2. Treat any planned update as a mismatch between this configuration and the dashboard, and fix the configuration. The one harmless exception is a TXT record whose stored content differs only by surrounding quotes.
3. A lookup error such as `Invalid index` or a null interpolation means the record or rule is not in Cloudflare as described. Check the dashboard before changing the configuration.
4. After merging, confirm the tracked run in Spacelift, then delete `imports.tf` in a follow-up pull request and decide whether to enable autodeploy.

## Local checks

Plans need the Spacelift-managed state, so run them through a pull request. Syntax and schema checks work locally:

```bash
tofu -chdir=infra/cloudflare init -backend=false
tofu -chdir=infra/cloudflare validate
tofu -chdir=infra/cloudflare fmt -check
```

When changing the provider version, refresh the lock file for both Spacelift's runners and local machines:

```bash
tofu -chdir=infra/cloudflare providers lock -platform=linux_amd64 -platform=darwin_arm64
```
