import { DatabaseSync } from "node:sqlite";

/**
 * Fills the local database with synthetic areas, climbs, climbers and ticks.
 *
 *   pnpm seed:climbs                        # 400 areas, 5000 climbs, 50 climbers
 *   pnpm seed:climbs --areas 50 --climbs 500 --users 3
 *   pnpm seed:climbs --seed 7               # a different, still repeatable set
 *   pnpm seed:climbs --force                # replace what is already there
 *
 * Synthetic climbers sign in with the password `password`, and any user already
 * in the database (the one `pnpm seed:user` makes) gets ticks too.
 *
 * Deterministic for a given --seed, so two checkouts asked for the same numbers
 * hold the same rows and a bug reproduces off the same ids.
 */
import { faker } from "@faker-js/faker";
import { hashPassword } from "better-auth/crypto";

import { requireLocalDb } from "./d1-local.ts";

// Ordinals into BOULDER_HUECO (VB–V17) and ROPE_YDS (5.0–5.15d) in lib/grades.
// Duplicated rather than imported: lib/ is reached through the `@/` alias, which
// bare `node scripts/…` does not resolve.
const MAX_GRADE = { boulder: 18, sport: 33, trad: 33 } as const;
const TYPES = ["boulder", "sport", "trad"] as const;
const SYNTHETIC_PASSWORD = "password";

type ClimbType = (typeof TYPES)[number];
type Climb = { id: number; type: ClimbType; grade: number | null };

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const value = Number(args[at + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} needs a positive integer, got ${args[at + 1] ?? "nothing"}`);
  }
  return value;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/** Mid-grades are the bulk of any crag; the extremes are rare. */
function bellGrade(max: number): number {
  const rolls = faker.number.int({ min: 0, max }) + faker.number.int({ min: 0, max });
  return Math.round(rolls / 2);
}

async function main() {
  const areaCount = flag("areas", 400);
  const climbCount = flag("climbs", 5000);
  const userCount = flag("users", 50);
  faker.seed(flag("seed", 1));

  // scrypt is deliberately slow, so hash the shared password once rather than
  // once per synthetic climber.
  const passwordHash = await hashPassword(SYNTHETIC_PASSWORD);

  const db = new DatabaseSync(requireLocalDb());
  let open = false;
  try {
    db.exec("pragma foreign_keys = on");

    const existing = db.prepare("select count(*) c from climbs").get() as { c: number };
    if (existing.c > 0 && !args.includes("--force")) {
      throw new Error(`Database already holds ${existing.c} climbs. Pass --force to replace them.`);
    }

    db.exec("begin");
    open = true;
    if (existing.c > 0) clear(db);
    const areaIds = insertAreas(db, areaCount);
    const climbs = insertClimbs(db, climbCount, areaIds);
    const userIds = insertUsers(db, userCount, passwordHash);
    const sendCount = insertSends(db, userIds, climbs);
    db.exec("commit");
    open = false;

    console.log(
      `Seeded ${areaCount.toLocaleString()} areas, ${climbCount.toLocaleString()} climbs, ` +
        `${userIds.length} climbers and ${sendCount.toLocaleString()} ticks.`,
    );
    console.log(`Synthetic climbers sign in with the password \`${SYNTHETIC_PASSWORD}\`.`);
    console.log("Restart `pnpm dev`: it holds its D1 handle open.");
  } catch (error) {
    // Rolling back when nothing began throws over the error worth reading.
    if (open) db.exec("rollback");
    throw error;
  } finally {
    db.close();
  }
}

/**
 * areas.parent_id is ON DELETE RESTRICT, so a bare `delete from areas` fails on
 * the first parent. Deleting deepest-first is what makes it terminate.
 */
function clear(db: DatabaseSync) {
  db.exec("delete from sends");
  db.exec("delete from climbs");
  // Their emails are unique, so a re-seed would collide. Sends and accounts
  // cascade. Anyone else — the dev user — is left alone.
  db.exec("delete from user where email like 'climber%@example.com'");
  while ((db.prepare("select count(*) c from areas").get() as { c: number }).c > 0) {
    db.exec(
      "delete from areas where id not in (select parent_id from areas where parent_id is not null)",
    );
  }
  // Without this the next seed's ids continue from the old high-water mark.
  db.exec("delete from sqlite_sequence where name in ('areas', 'climbs')");
}

/** Regions hold crags hold sectors; climbs hang off the leaves. */
function insertAreas(db: DatabaseSync, count: number): number[] {
  const insert = db.prepare("insert into areas (parent_id, name, description) values (?, ?, ?)");

  const regionCount = Math.max(1, Math.round(count * 0.06));
  const cragCount = Math.max(1, Math.round(count * 0.24));

  const regions: number[] = [];
  const crags: number[] = [];
  const leaves: number[] = [];

  for (let i = 0; i < count; i += 1) {
    let parent: number | null = null;
    let name: string;

    if (i < regionCount) {
      name = `${faker.location.state()} ${faker.helpers.arrayElement(["Range", "Region", "Highlands", "Basin"])}`;
    } else if (i < regionCount + cragCount) {
      parent = faker.helpers.arrayElement(regions);
      name = `${faker.location.street().replace(/\s+(Street|Road|Avenue|Lane|Drive)$/, "")} ${faker.helpers.arrayElement(["Crag", "Canyon", "Wall", "Bluff", "Boulders"])}`;
    } else {
      parent = faker.helpers.arrayElement(crags);
      name = `${faker.word.adjective()} ${faker.helpers.arrayElement(["Slab", "Cave", "Arete", "Face", "Block", "Roof"])}`;
    }

    const id = insert.run(parent, title(name), maybeDescription()).lastInsertRowid as number;
    if (i < regionCount) regions.push(id);
    else if (i < regionCount + cragCount) crags.push(id);
    else leaves.push(id);
  }

  // With very small --areas there may be no third tier to hang climbs from.
  return leaves.length > 0 ? leaves : crags.length > 0 ? crags : regions;
}

function insertClimbs(db: DatabaseSync, count: number, areaIds: number[]): Climb[] {
  const insert = db.prepare(
    "insert into climbs (area_id, name, type, grade, description) values (?, ?, ?, ?, ?)",
  );
  const climbs: Climb[] = [];
  for (let i = 0; i < count; i += 1) {
    const type: ClimbType = faker.helpers.arrayElement(TYPES);
    // A real database has ungraded projects in it.
    const grade = faker.datatype.boolean(0.95) ? bellGrade(MAX_GRADE[type]) : null;
    const id = insert.run(
      faker.helpers.arrayElement(areaIds),
      title(`${faker.word.adjective()} ${faker.word.noun()}`),
      type,
      grade,
      maybeDescription(),
    ).lastInsertRowid as number;
    climbs.push({ id, type, grade });
  }
  return climbs;
}

/** Verified so they can sign in without walking the email flow. */
function insertUsers(db: DatabaseSync, count: number, passwordHash: string): string[] {
  const insertUser = db.prepare(
    "insert into user (id, name, email, email_verified) values (?, ?, ?, 1)",
  );
  const insertAccount = db.prepare(
    "insert into account (id, account_id, provider_id, user_id, password, updated_at)" +
      " values (?, ?, 'credential', ?, ?, cast(unixepoch('subsecond') * 1000 as integer))",
  );

  // Anyone already here — `pnpm seed:user`'s dev@example.com — should get ticks
  // too, so their profile is not the one empty page in the app.
  const existing = (db.prepare("select id from user").all() as { id: string }[]).map((r) => r.id);

  for (let i = 0; i < count; i += 1) {
    const id = faker.string.uuid();
    // Positional, not faker.internet.email(): unique by construction, and
    // `user.email` is unique under a case-sensitive collation.
    insertUser.run(id, faker.person.fullName(), `climber${i + 1}@example.com`);
    insertAccount.run(faker.string.uuid(), id, id, passwordHash);
    existing.push(id);
  }
  return existing;
}

function insertSends(db: DatabaseSync, userIds: string[], climbs: Climb[]): number {
  const insert = db.prepare(
    "insert into sends (user_id, climb_id, ascent_style, date_sent, rating," +
      " suggested_grade, grade_feel, comment) values (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  let total = 0;

  for (const userId of userIds) {
    // Long-tailed on purpose: most climbers log a season, a few log years, and
    // a flat distribution gives every profile the same shape to look at.
    const wanted = faker.helpers.weightedArrayElement([
      { weight: 6, value: () => faker.number.int({ min: 20, max: 200 }) },
      { weight: 3, value: () => faker.number.int({ min: 200, max: 600 }) },
      { weight: 1, value: () => faker.number.int({ min: 600, max: 1200 }) },
    ])();
    // arrayElements samples without replacement, which is what keeps this
    // inside the (user_id, climb_id) unique index.
    const ticked = faker.helpers.arrayElements(climbs, Math.min(climbs.length, wanted));
    for (const climb of ticked) {
      insert.run(
        userId,
        climb.id,
        faker.helpers.weightedArrayElement([
          { weight: 6, value: "redpoint" },
          { weight: 3, value: "flash" },
          { weight: 1, value: "onsight" },
        ]),
        // Imported ticks often have no date at all.
        faker.datatype.boolean(0.9)
          ? faker.date.between({ from: "2021-01-01", to: "2026-09-01" }).toISOString().slice(0, 10)
          : null,
        faker.datatype.boolean(0.75) ? faker.number.int({ min: 2, max: 5 }) : null,
        climb.grade !== null && faker.datatype.boolean(0.25)
          ? clamp(climb.grade + faker.number.int({ min: -1, max: 1 }), MAX_GRADE[climb.type])
          : null,
        faker.helpers.weightedArrayElement([
          { weight: 6, value: "solid" },
          { weight: 2, value: "high" },
          { weight: 2, value: "low" },
        ]),
        faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
      );
      total += 1;
    }
  }
  return total;
}

function title(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function maybeDescription(): string | null {
  return faker.datatype.boolean(0.4) ? faker.lorem.sentence() : null;
}
