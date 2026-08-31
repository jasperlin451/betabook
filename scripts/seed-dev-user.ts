/**
 * Seeds a verified email/password user straight into the *local* D1 database,
 * so local development isn't limited to anonymous browsing.
 *
 * Signing up through the UI works too, but costs an extra round trip: with
 * `requireEmailVerification: true` in lib/auth.ts you have to fish the
 * verification link out of the `next dev` logs (lib/email.ts console.logs it
 * whenever RESEND_API_KEY is unset) and click it. This script skips that by
 * writing `email_verified = 1` directly.
 *
 * Usage:
 *   pnpm seed:user                          # dev@example.com / password / "Dev User"
 *   pnpm seed:user me@example.com hunter2 Jasper
 *
 * Re-running with the same email resets that user's name and password rather
 * than erroring, so it doubles as a "reset my local password" escape hatch.
 * The user's id is preserved, so any sends they've logged survive a re-run.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const [email = "dev@example.com", password = "password", name = "Dev User"] =
  process.argv.slice(2);

/** SQLite string literal — doubling `'` is the whole escaping rule. */
const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

async function main() {
  // Hash with better-auth's own helper rather than reimplementing scrypt, so
  // the stored format tracks whatever the installed better-auth version
  // expects `verifyPassword` to read back.
  const hash = await hashPassword(password);

  // The account rows are matched on (user_id, provider_id) rather than a
  // stable id, so a fresh uuid is only used when no credential account
  // exists yet — see the guarded INSERT below.
  const sql = `
INSERT INTO user (id, name, email, email_verified)
VALUES (${q(randomUUID())}, ${q(name)}, ${q(email)}, 1)
ON CONFLICT (email) DO UPDATE SET
  name = excluded.name,
  email_verified = 1,
  updated_at = cast(unixepoch('subsecond') * 1000 as integer);

INSERT INTO account (id, account_id, provider_id, user_id, password, updated_at)
SELECT ${q(randomUUID())}, u.id, 'credential', u.id, ${q(hash)},
       cast(unixepoch('subsecond') * 1000 as integer)
FROM user u
WHERE u.email = ${q(email)}
  AND NOT EXISTS (
    SELECT 1 FROM account a
    WHERE a.user_id = u.id AND a.provider_id = 'credential'
  );

UPDATE account
SET password = ${q(hash)},
    updated_at = cast(unixepoch('subsecond') * 1000 as integer)
WHERE provider_id = 'credential'
  AND user_id = (SELECT id FROM user WHERE email = ${q(email)});
`;

  // --local is not optional here: this writes a known-weak password, and must
  // never be pointed at the deployed database.
  execFileSync("wrangler", ["d1", "execute", "DB", "--local", "--command", sql], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  console.log(`Seeded local user ${email} (password: ${password})`);
  console.log("Sign in at http://localhost:3000/sign-in");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
