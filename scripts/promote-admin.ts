import { DatabaseSync } from "node:sqlite";

/**
 * Grants the admin role to an existing user in the local database.
 *
 *   pnpm promote-admin dev@example.com
 *
 * There's no UI for this yet — it's the only way to create the first admin.
 * For a deployed environment, run the equivalent UPDATE with
 * `wrangler d1 execute DB --remote --command "..."` instead; this script
 * only ever touches the local .wrangler sqlite file.
 */
import { requireLocalDb } from "./d1-local.ts";

// better-auth lowercases emails at sign-up, so match the same way — a
// mixed-case argument would otherwise miss an existing account.
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: pnpm promote-admin <email>");

const db = new DatabaseSync(requireLocalDb());
const result = db.prepare(`UPDATE user SET role = 'admin' WHERE email = ?`).run(email);

if (result.changes === 0) throw new Error(`No user found with email ${email}`);

console.log(`${email} is now an admin.`);
