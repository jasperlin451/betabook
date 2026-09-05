import type { AnalyticsSendRow } from "@/db/queries";
import { nativeGradeArray } from "@/lib/grades";
import { buildUserAnalytics } from "@/lib/user-analytics";

/** Fictional, browser-only tutorial data. These IDs must never be used in links or writes. */
export const TOUR_DEMO_CLIMBER = { name: "Alex Morgan", initials: "AM", area: "Pine Canyon" };

const climbs = {
  warmup: { id: -1, name: "First Light", grade: "V2" },
  sent: { id: -2, name: "Quiet Arete", grade: "V4" },
  flash: { id: -3, name: "Moss Ladder", grade: "V3" },
  project: { id: -4, name: "The Long Way", grade: "V5" },
} as const;

type DemoEntry = {
  id: string;
  date: string;
  kind: "session" | "training";
  outcome: "Session" | "Sent" | "Repeat" | "Training";
  climb: (typeof climbs)[keyof typeof climbs] | null;
  note: string;
  tags: string[];
  rating?: number;
  style?: "flash" | "redpoint";
};

export const TOUR_DEMO_ENTRIES: readonly DemoEntry[] = [
  {
    id: "project-two",
    date: "2026-03-14",
    kind: "session",
    outcome: "Session",
    climb: climbs.project,
    note: "Linked the start. Next time: keep the left heel on for the crux.",
    tags: ["footwork", "project"],
  },
  {
    id: "training",
    date: "2026-03-13",
    kind: "training",
    outcome: "Training",
    climb: null,
    note: "Silent-feet drills at the gym, then easy endurance laps.",
    tags: ["footwork"],
  },
  {
    id: "project-one",
    date: "2026-03-12",
    kind: "session",
    outcome: "Session",
    climb: climbs.project,
    note: "Found the holds but couldn't link the crux.",
    tags: ["project"],
  },
  {
    id: "repeat",
    date: "2026-03-12",
    kind: "session",
    outcome: "Repeat",
    climb: climbs.sent,
    note: "Repeated it with quieter feet. The high step feels easier now.",
    tags: ["footwork"],
  },
  {
    id: "flash",
    date: "2026-03-12",
    kind: "session",
    outcome: "Sent",
    climb: climbs.flash,
    note: "Read the sequence from the ground and flashed it.",
    tags: [],
    rating: 5,
    style: "flash",
  },
  {
    id: "send",
    date: "2026-02-15",
    kind: "session",
    outcome: "Sent",
    climb: climbs.sent,
    note: "Finally stuck the high step after working the sequence.",
    tags: ["footwork"],
    rating: 4,
    style: "redpoint",
  },
  {
    id: "strength",
    date: "2026-02-14",
    kind: "training",
    outcome: "Training",
    climb: null,
    note: "Pull-ups and core work. Kept it light before tomorrow's session.",
    tags: ["strength"],
  },
  {
    id: "warmup",
    date: "2026-01-10",
    kind: "session",
    outcome: "Sent",
    climb: climbs.warmup,
    note: "A good first climb of the year.",
    tags: [],
    rating: 3,
    style: "redpoint",
  },
];

export const TOUR_DEMO_SENDS = TOUR_DEMO_ENTRIES.flatMap((entry) => {
  if (entry.outcome !== "Sent" || !entry.climb) return [];
  return [
    {
      climbId: entry.climb.id,
      climbName: entry.climb.name,
      climbType: "boulder" as const,
      suggestedGrade: nativeGradeArray("boulder").indexOf(entry.climb.grade),
      areaId: -1,
      areaName: TOUR_DEMO_CLIMBER.area,
      ascentStyle: entry.style ?? "redpoint",
      dateSent: entry.date,
      rating: entry.rating ?? 0,
      note: entry.note,
    } satisfies AnalyticsSendRow & { rating: number; note: string },
  ];
});

export const TOUR_DEMO_PROJECT = {
  ...climbs.project,
  sessions: TOUR_DEMO_ENTRIES.filter((entry) => entry.climb?.id === climbs.project.id),
};

export const TOUR_DEMO_ANALYTICS = buildUserAnalytics(
  TOUR_DEMO_SENDS,
  "boulder",
  TOUR_DEMO_ENTRIES.filter((entry) => entry.kind === "session").map((entry) => ({
    entryDate: entry.date,
    climbType: "boulder",
  })),
);
