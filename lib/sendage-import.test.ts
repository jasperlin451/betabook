import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSendageImport } from "./sendage-import";
import { parseSendageUsername } from "./sendage-profile";

const envelope = (json: unknown) => Response.json({ result: { data: { json } } });
const profile = (extra = {}) =>
  envelope({ profile: { id: 42, slug: "climber", isPrivate: false, totalSends: 2, ...extra } });
function item(id: number, extra = {}) {
  return {
    climb: {
      id,
      name: `Climb ${id}`,
      type: "sport",
      gradeId: 62,
      area: { name: "Wall", parent: { name: "Crag" } },
    },
    userSend: {
      id: id + 100,
      sendType: "onsight",
      gradeId: 51,
      day: "2026-08-16",
      rating: 0,
      difficulty: -1,
      comments: "Nice &amp; sunny",
      beta: "High foot",
      attempts: 1,
      firstAscent: false,
      ...extra,
    },
  };
}
const options = () => ({ signal: new AbortController().signal });
afterEach(() => vi.unstubAllGlobals());

describe("Sendage import", () => {
  it("downloads every page without credentials and preserves personal send values", async () => {
    const fetcher = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(envelope({ items: [item(1)], nextCursor: 1 }))
      .mockResolvedValueOnce(envelope({ items: [item(2, { day: null, rating: 5 })] }));
    vi.stubGlobal("fetch", fetcher);
    const onProgress = vi.fn<(count: number) => void>();
    const result = await fetchSendageImport("https://sendage.com/user/climber?tab=sends", {
      ...options(),
      onProgress,
    });
    expect(result.username).toBe("climber");
    expect(result.parsed.rows).toHaveLength(2);
    expect(result.parsed.rows[0]).toMatchObject({
      Climb: "Climb 1",
      Date: "2026-08-16",
      "Send Type": "onsight",
      Grade: "5.11b",
      "Posted Grade": "5.12a",
      Rating: "",
      "Grade Feel": "soft",
      Comments: "Nice &amp; sunny",
      Area: "Wall",
      Region: "Crag",
      Beta: "High foot",
    });
    expect(result.parsed.rows[1]).toMatchObject({ Date: "", Rating: "5" });
    expect(onProgress).toHaveBeenLastCalledWith(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(url).origin).toBe("https://sendage.com");
      expect(init?.credentials).toBe("omit");
    }
    const input = JSON.parse(new URL(fetcher.mock.calls[2][0]).searchParams.get("input")!);
    expect(input.json).toMatchObject({
      cursor: 1,
      userId: 42,
      includeUserClimb: true,
      sendType: ["redpoint", "flash", "onsight"],
    });
  });

  it("rejects private profiles before requesting their sends", async () => {
    const fetcher = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(profile({ isPrivate: true }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(/public profile/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not return partial rows when a later page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<(url: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(profile())
        .mockResolvedValueOnce(envelope({ items: [item(1)], nextCursor: 1 }))
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 })),
    );
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(/try again/i);
  });

  it("detects truncated results instead of treating them as a complete import", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<(url: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(profile())
        .mockResolvedValueOnce(envelope({ items: [item(1)] })),
    );
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(/complete.*CSV/i);
  });

  it("rejects repeated cursors and never requests beyond Sendage's page limit", async () => {
    for (const nextCursor of [0, 21]) {
      const fetcher = vi
        .fn<(url: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(profile())
        .mockResolvedValueOnce(envelope({ items: [item(1)], nextCursor }));
      vi.stubGlobal("fetch", fetcher);
      await expect(fetchSendageImport("climber", options())).rejects.toThrow(/complete.*CSV/i);
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });

  it("fails closed when the API omits send details", async () => {
    const row = item(1);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<(url: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(profile({ totalSends: 1 }))
        .mockResolvedValueOnce(envelope({ items: [{ climb: row.climb }] })),
    );
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(/format/i);
  });

  it.each([
    ["boulder", 12, "V0"],
    ["boulder", 13, "V1"],
    ["boulder", 62, "V10"],
    ["boulder", 63, "V11"],
    ["boulder", 96, "V17"],
    ["sport", 60, "5.11d"],
    ["sport", 61, "5.12a"],
    ["sport", 62, "5.12a"],
    ["sport", 65, "5.12a"],
    ["sport", 66, "5.12b"],
    ["trad", 62, "5.12a"],
    ["sport", 140, "5.15d"],
  ])(
    "maps published Sendage %s ID %s to %s without a grading preference",
    async (type, gradeId, label) => {
      const row = item(1, { gradeId });
      row.climb = { ...row.climb, type, gradeId };
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(profile({ totalSends: 1 }))
          .mockResolvedValueOnce(envelope({ items: [row] })),
      );
      const result = await fetchSendageImport("climber", options());
      expect(result.parsed.rows[0]).toMatchObject({ Grade: label, "Posted Grade": label });
    },
  );

  it.each([
    ["boulder", 97],
    ["sport", 141],
    ["trad", 141],
    ["sport", 0],
    ["sport", 1.5],
    ["sport", "62"],
    ["sport", null],
  ])("stops on an unknown or invalid %s grade ID %s", async (type, gradeId) => {
    const row = item(1, { gradeId });
    row.climb.type = type;
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(profile({ totalSends: 1 }))
        .mockResolvedValueOnce(envelope({ items: [row] })),
    );
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(
      /unknown.*grade ID.*Import stopped/i,
    );
  });

  it("discards earlier pages if a later climb has an unknown posted grade", async () => {
    const row = item(2);
    row.climb.gradeId = 141;
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(profile())
        .mockResolvedValueOnce(envelope({ items: [item(1)], nextCursor: 1 }))
        .mockResolvedValueOnce(envelope({ items: [row] })),
    );
    await expect(fetchSendageImport("climber", options())).rejects.toThrow(
      /unknown.*grade ID.*Import stopped/i,
    );
  });

  it("honors cancellation before issuing a request", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchSendageImport("climber", { signal: controller.signal })).rejects.toThrow(
      /abort/i,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Sendage profile input", () => {
  it.each([
    "climber",
    " @climber ",
    "https://sendage.com/user/climber?tab=sends",
    "sendage.com/user/climber/",
  ])("normalizes %s", (input) => {
    expect(parseSendageUsername(input)).toBe("climber");
  });
  it.each([
    "",
    "https://evil.test/user/climber",
    "https://sendage.com.evil.test/user/climber",
    "https://sendage.com/profile?tab=sends",
    "https://name:pass@sendage.com/user/climber",
    "../admin",
    "https://sendage.com/user/a%2Fb",
  ])("rejects %s", (input) => {
    expect(() => parseSendageUsername(input)).toThrow(/Sendage|profile|username/i);
  });
});
