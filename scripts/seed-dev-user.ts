/**
 * Seeds a pre-verified email/password user into the local D1 database.
 *
 *   pnpm seed:user                                  # dev@example.com / password
 *   pnpm seed:user me@example.com hunter2 Jasper
 *
 * Idempotent on email: a re-run rotates the password and name but keeps the
 * user id, and so their sends.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const [email = "dev@example.com", password = "password", name = "Dev User"] =
  process.argv.slice(2);

/** SQLite string literal — doubling `'` is the whole escaping rule. */
const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

async function main() {
  // better-auth's own helper, so the stored format stays whatever the
  // installed version's `verifyPassword` reads back.
  const hash = await hashPassword(password);

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

  // --local is load-bearing: this writes a known-weak password.
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
