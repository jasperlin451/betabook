import { DatabaseSync } from "node:sqlite";

/**
 * Fills the local database with synthetic areas and climbs.
 *
 *   pnpm seed:climbs                        # 400 areas, 5000 climbs
 *   pnpm seed:climbs --areas 50 --climbs 500
 *   pnpm seed:climbs --seed 7               # a different, still repeatable set
 *   pnpm seed:climbs --force                # replace what is already there
 *
 * Deterministic for a given --seed, so two checkouts asked for the same numbers
 * hold the same rows and a bug reproduces off the same ids.
 */
import { faker } from "@faker-js/faker";

import { requireLocalDb } from "./d1-local.ts";

// Ordinals into BOULDER_HUECO (VB–V17) and ROPE_YDS (5.0–5.15d) in lib/grades.
// Duplicated rather than imported: lib/ is reached through the `@/` alias, which
// bare `node scripts/…` does not resolve.
const MAX_GRADE = { boulder: 18, sport: 33, trad: 33 } as const;
const TYPES = ["boulder", "sport", "trad"] as const;

type ClimbType = (typeof TYPES)[number];

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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

/** Mid-grades are the bulk of any crag; the extremes are rare. */
function bellGrade(max: number): number {
  const rolls = faker.number.int({ min: 0, max }) + faker.number.int({ min: 0, max });
  return Math.round(rolls / 2);
}

function main() {
  const areaCount = flag("areas", 400);
  const climbCount = flag("climbs", 5000);
  faker.seed(flag("seed", 1));

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
    insertClimbs(db, climbCount, areaIds);
    db.exec("commit");
    open = false;

    console.log(
      `Seeded ${areaCount.toLocaleString()} areas and ${climbCount.toLocaleString()} climbs.`,
    );
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

function insertClimbs(db: DatabaseSync, count: number, areaIds: number[]) {
  const insert = db.prepare(
    "insert into climbs (area_id, name, type, grade, description) values (?, ?, ?, ?, ?)",
  );
  for (let i = 0; i < count; i += 1) {
    const type: ClimbType = faker.helpers.arrayElement(TYPES);
    insert.run(
      faker.helpers.arrayElement(areaIds),
      title(`${faker.word.adjective()} ${faker.word.noun()}`),
      type,
      // A real database has ungraded projects in it.
      faker.datatype.boolean(0.95) ? bellGrade(MAX_GRADE[type]) : null,
      maybeDescription(),
    );
  }
}

function title(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function maybeDescription(): string | null {
  return faker.datatype.boolean(0.4) ? faker.lorem.sentence() : null;
}
