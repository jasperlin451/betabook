/** Stable application binding contract. `wrangler types` remains useful for
 * auditing the complete platform surface, but builds and tests must not
 * depend on a gitignored, machine-local generated file. */
interface CloudflareEnv {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
}

declare namespace Cloudflare {
  interface Env {
    DB: CloudflareEnv["DB"];
    BETTER_AUTH_URL: CloudflareEnv["BETTER_AUTH_URL"];
    BETTER_AUTH_SECRET: CloudflareEnv["BETTER_AUTH_SECRET"];
    RESEND_API_KEY: CloudflareEnv["RESEND_API_KEY"];
  }
}
