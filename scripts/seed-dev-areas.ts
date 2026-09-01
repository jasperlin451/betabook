/**
 * Seeds a tree of areas and climbs into the local D1 database.
 *
 *   pnpm seed:areas
 *
 * Idempotent on (parent, name) for areas and (area, name) for climbs: a re-run
 * inserts nothing and keeps every id, so sends logged against a seeded climb
 * survive it.
 */
import { execFileSync } from "node:child_process";
import { nativeGradeArray, type ClimbType } from "../lib/grades";

type SeedClimb = {
  name: string;
  type: ClimbType;
  /** Native grade label (V-scale or YDS). Omit for an ungraded project. */
  grade?: string;
  description?: string;
};

type SeedArea = {
  name: string;
  description?: string;
  areas?: SeedArea[];
  climbs?: SeedClimb[];
};

const AREAS: SeedArea[] = [
  {
    name: "Bishop",
    description: "High desert bouldering on the eastern edge of the Sierra.",
    areas: [
      {
        name: "Buttermilks",
        description: "Highball granite eggs below the Sierra crest.",
        areas: [
          {
            name: "Peabody Boulders",
            climbs: [
              { name: "The Mandala", type: "boulder", grade: "V12" },
              { name: "Iron Man Traverse", type: "boulder", grade: "V4" },
              { name: "Birthday Direct", type: "boulder", grade: "V3" },
              { name: "Green Wall Essential", type: "boulder", grade: "V4" },
            ],
          },
          {
            name: "Grandpa Peabody",
            climbs: [
              { name: "Evilution Direct", type: "boulder", grade: "V11" },
              { name: "Ambrosia", type: "boulder", grade: "V11" },
              { name: "Lidija's Project", type: "boulder" },
            ],
          },
        ],
      },
      {
        name: "Happy Boulders",
        description: "Volcanic tablelands, pockets and jugs.",
        climbs: [
          { name: "Serengeti", type: "boulder", grade: "V5" },
          { name: "Heavenly Path", type: "boulder", grade: "V2" },
          { name: "The Hulk", type: "boulder", grade: "V6" },
        ],
      },
      {
        name: "Owens River Gorge",
        description: "Roadside sport climbing in welded tuff.",
        climbs: [
          { name: "Pump-o-Rama", type: "sport", grade: "5.10c" },
          { name: "Heart of Darkness", type: "sport", grade: "5.12a" },
          { name: "Cardinal Sin", type: "sport", grade: "5.11b" },
        ],
      },
    ],
  },
  {
    name: "Yosemite Valley",
    description: "Glacier-polished granite, big walls and the Camp 4 circuit.",
    areas: [
      {
        name: "Camp 4",
        climbs: [
          { name: "Midnight Lightning", type: "boulder", grade: "V8" },
          { name: "Blue Suede Shoes", type: "boulder", grade: "V4" },
        ],
      },
      {
        name: "El Capitan",
        climbs: [
          { name: "Freerider", type: "trad", grade: "5.12d" },
          { name: "Salathe Wall", type: "trad", grade: "5.13b" },
          { name: "The Nose", type: "trad", grade: "5.14a" },
        ],
      },
      {
        name: "Cathedral Rocks",
        climbs: [
          { name: "Braille Book", type: "trad", grade: "5.8" },
          { name: "Central Pillar of Frenzy", type: "trad", grade: "5.9" },
        ],
      },
    ],
  },
  {
    name: "Red River Gorge",
    description: "Overhanging Corbin sandstone in eastern Kentucky.",
    areas: [
      {
        name: "Muir Valley",
        climbs: [
          { name: "Fuzzy Undercling", type: "sport", grade: "5.11c" },
          { name: "Sanctuary", type: "sport", grade: "5.12a" },
        ],
      },
      {
        name: "The Motherlode",
        climbs: [
          { name: "Golden Boy", type: "sport", grade: "5.13a" },
          { name: "Convicted", type: "sport", grade: "5.12d" },
          { name: "Ale-8-One", type: "sport", grade: "5.10d" },
        ],
      },
    ],
  },
];

/** SQLite string literal — doubling `'` is the whole escaping rule. */
const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const qOrNull = (value: string | undefined) => (value == null ? "NULL" : q(value));

/** Indexed the way the app reads climbs.grade, so a typo'd label throws here
 * instead of seeding a climb graded something else. */
function gradeIndex(climb: SeedClimb): number | null {
  if (climb.grade == null) return null;
  const index = nativeGradeArray(climb.type).indexOf(climb.grade);
  if (index === -1) {
    throw new Error(`Unknown ${climb.type} grade ${climb.grade} on ${climb.name}`);
  }
  return index;
}

/** Areas have no unique key, so (parent, name) is what the insert guard and a
 * child's parent_id both resolve against. */
function areaRef(name: string, parent: string | null): string {
  const parentMatch = parent === null ? "parent_id IS NULL" : `parent_id = (${parent})`;
  return `SELECT id FROM areas WHERE name = ${q(name)} AND ${parentMatch}`;
}

const statements: string[] = [];
let areaCount = 0;
let climbCount = 0;

function walk(area: SeedArea, parentRef: string | null) {
  const self = areaRef(area.name, parentRef);
  const parentValue = parentRef === null ? "NULL" : `(${parentRef})`;

  statements.push(
    `INSERT INTO areas (parent_id, name, description)
SELECT ${parentValue}, ${q(area.name)}, ${qOrNull(area.description)}
WHERE NOT EXISTS (${self});`,
  );
  areaCount++;

  for (const climb of area.climbs ?? []) {
    const grade = gradeIndex(climb);
    statements.push(
      `INSERT INTO climbs (area_id, name, type, grade, description)
SELECT (${self}), ${q(climb.name)}, ${q(climb.type)}, ${grade ?? "NULL"}, ${qOrNull(climb.description)}
WHERE NOT EXISTS (
  SELECT 1 FROM climbs WHERE name = ${q(climb.name)} AND area_id = (${self})
);`,
    );
    climbCount++;
  }

  for (const child of area.areas ?? []) walk(child, self);
}

for (const area of AREAS) walk(area, null);

// --local is load-bearing: this is throwaway fixture data, not content.
execFileSync("wrangler", ["d1", "execute", "DB", "--local", "--command", statements.join("\n")], {
  stdio: ["ignore", "ignore", "inherit"],
});

console.log(`Seeded ${areaCount} areas and ${climbCount} climbs into the local database.`);
console.log("Restart `pnpm dev` to see them — it holds its D1 handle open.");
