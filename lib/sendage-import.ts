import { parseSendageUsername } from "@/lib/sendage-profile";
import type { ParsedCsv } from "@/lib/sends-import";

const FORMAT_ERROR =
  "Sendage returned an unfamiliar data format. Use a CSV export or try again later.";
const INCOMPLETE_ERROR =
  "Sendage did not return your complete send history. Use a CSV export to import all sends.";
// The public climb.search contract accepts page indices 0–20. Do not split
// searches to work around that limit or pass partial results to the wizard.
const MAX_CURSOR = 20;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const HEADERS = [
  "Date",
  "Send Type",
  "Climb",
  "Climb Type",
  "Area",
  "Region",
  "Grade",
  "Posted Grade",
  "Grade Feel",
  "Rating",
  "Comments",
  "Beta",
  "Attempts",
  "First Ascent",
];

// Sendage's North American grade ID ranges, verified against its public client
// on 2026-09-08: https://sendage.com/webapp-assets/index-D30Z5_34.js
// The table has contiguous IDs 1–140, with boulder labels through 96. These
// IDs are independent of the viewer’s grading preference. Sport and trad share YDS.
const BOULDER_ENDS = [12, 16, 20, 25, 31, 37, 42, 46, 51, 57, 62, 67, 72, 77, 82, 87, 92, 96];
const ROUTE_ENDS = [
  1, 2, 3, 4, 5, 6, 10, 17, 25, 30, 35, 40, 45, 49, 52, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
  105, 110, 115, 120, 125, 130, 135, 140,
];

function gradeLabel(value: unknown, type: string) {
  const ends = type === "boulder" ? BOULDER_ENDS : ROUTE_ENDS;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > ends[ends.length - 1]
  )
    throw new Error(
      `Sendage returned an unknown ${type} grade ID. Import stopped; no sends were imported.`,
    );
  const index = ends.findIndex((end) => value <= end);
  if (type === "boulder") return `V${index}`;
  if (index < 9) return `5.${index + 1}`;
  return `5.${10 + Math.floor((index - 9) / 4)}${"abcd"[(index - 9) % 4]}`;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(FORMAT_ERROR);
  return value as Record<string, unknown>;
}
function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error(FORMAT_ERROR);
  return value;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error(FORMAT_ERROR);
  return value;
}
function optionalString(value: unknown): string {
  return value == null ? "" : string(value);
}

async function request(
  procedure: "user.getProfile" | "climb.search",
  input: Record<string, unknown>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 15_000);
  try {
    const url = new URL(`https://sendage.com/api/v2/${procedure}`);
    url.searchParams.set("input", JSON.stringify({ json: input }));
    const response = await fetch(url.toString(), {
      credentials: "omit",
      signal: controller.signal,
    });
    if (response.status === 404)
      throw new Error(
        "That Sendage profile could not be found. Check the username or profile link.",
      );
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "Sendage could not share this public profile. Check its visibility or use a CSV export.",
      );
    if (response.status === 429)
      throw new Error("Sendage is receiving too many requests. Wait a moment and try again.");
    if (!response.ok) throw new Error("Couldn't load sends from Sendage. Please try again.");
    if (Number(response.headers.get("content-length")) > MAX_PAGE_BYTES)
      throw new Error(FORMAT_ERROR);
    const body = await response.text();
    if (body.length > MAX_PAGE_BYTES) throw new Error(FORMAT_ERROR);
    const data: unknown = JSON.parse(body);
    return record(record(record(data).result).data).json;
  } catch (error) {
    signal.throwIfAborted();
    if (controller.signal.aborted)
      throw new Error("Sendage took too long to respond. Please try again.", { cause: error });
    if (error instanceof TypeError)
      throw new Error(
        "Couldn't connect to Sendage. Check your connection and try again, or use a CSV export.",
        { cause: error },
      );
    if (error instanceof SyntaxError) throw new Error(FORMAT_ERROR, { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}

function importRow(value: unknown) {
  const item = record(value);
  const climb = record(item.climb);
  const send = record(item.userSend);
  const id = positiveInteger(send.id);
  positiveInteger(climb.id);
  const type = string(climb.type);
  if (!["boulder", "sport", "trad"].includes(type)) throw new Error(FORMAT_ERROR);
  const area = record(climb.area);
  const style = string(send.sendType);
  if (!["redpoint", "flash", "onsight"].includes(style)) throw new Error(FORMAT_ERROR);
  if (
    typeof send.rating !== "number" ||
    !Number.isInteger(send.rating) ||
    send.rating < 0 ||
    send.rating > 5
  )
    throw new Error(FORMAT_ERROR);
  if (![-1, 0, 1].includes(Number(send.difficulty)) || typeof send.difficulty !== "number")
    throw new Error(FORMAT_ERROR);
  const date = optionalString(send.day);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(FORMAT_ERROR);
  const row: Record<string, string> = {
    Date: date,
    "Send Type": style,
    Climb: string(climb.name),
    "Climb Type": type,
    Area: string(area.name),
    Region: area.parent == null ? "" : string(record(area.parent).name),
    Grade: gradeLabel(send.gradeId, type),
    "Posted Grade": gradeLabel(climb.gradeId, type),
    "Grade Feel": send.difficulty === -1 ? "soft" : send.difficulty === 1 ? "stiff" : "fair",
    Rating: send.rating === 0 ? "" : String(send.rating),
    Comments: optionalString(send.comments),
    Beta: optionalString(send.beta),
    Attempts: send.attempts == null ? "" : String(positiveInteger(send.attempts)),
    "First Ascent": send.firstAscent === true ? "Yes" : "",
  };
  return { id, row };
}

export async function fetchSendageImport(
  input: string,
  { signal, onProgress }: { signal: AbortSignal; onProgress?: (count: number) => void },
): Promise<{ username: string; parsed: ParsedCsv }> {
  const username = parseSendageUsername(input);
  const data = record(await request("user.getProfile", { username }, signal));
  if (data.profile == null)
    throw new Error("That Sendage profile could not be found. Check the username or profile link.");
  const profile = record(data.profile);
  if (profile.isPrivate !== false)
    throw new Error(
      "Sendage imports need a public profile. Use a CSV export for a private profile.",
    );
  const userId = positiveInteger(profile.id);
  const canonicalName = parseSendageUsername(profile.slug);
  const total = profile.totalSends;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0)
    throw new Error(FORMAT_ERROR);
  const rows: Record<string, string>[] = [];
  const seen = new Set<number>();
  let cursor = 0;
  for (;;) {
    signal.throwIfAborted();
    const page = record(
      await request(
        "climb.search",
        {
          term: "",
          sortBy: "date",
          sortDir: "desc",
          minSends: 0,
          minRating: 0,
          includeUserClimb: true,
          userId,
          sendType: ["redpoint", "flash", "onsight"],
          boulder: { enabled: true, min: 1, max: 1000 },
          sport: { enabled: true, min: 1, max: 1000 },
          trad: { enabled: true, min: 1, max: 1000 },
          cursor,
          direction: "forward",
        },
        signal,
      ),
    );
    if (!Array.isArray(page.items) || page.items.length > 1000) throw new Error(FORMAT_ERROR);
    for (const item of page.items) {
      const { id, row } = importRow(item);
      if (seen.has(id))
        throw new Error("Your Sendage history changed during the download. Please try again.");
      seen.add(id);
      rows.push(row);
    }
    onProgress?.(rows.length);
    const next = page.nextCursor;
    if (next == null) break;
    if (
      !page.items.length ||
      typeof next !== "number" ||
      !Number.isInteger(next) ||
      next <= cursor ||
      next > MAX_CURSOR
    )
      throw new Error(INCOMPLETE_ERROR);
    cursor = next;
  }
  signal.throwIfAborted();
  if (rows.length < total) throw new Error(INCOMPLETE_ERROR);
  return {
    username: canonicalName,
    parsed: {
      headers: HEADERS,
      rows,
      derived: [],
      warnings: rows.some((row) => row.Beta || row.Attempts || row["First Ascent"])
        ? [
            "Sendage beta, attempts, and first-ascent flags are available as source columns. They are not imported automatically; map a column to Comment if you want to keep it there.",
          ]
        : [],
    },
  };
}
