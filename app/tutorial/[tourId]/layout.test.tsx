import { beforeEach, describe, expect, it, vi } from "vitest";

import TutorialPage from "@/app/tutorial/[tourId]/[stepId]/page";
import TutorialLayout, { metadata } from "@/app/tutorial/[tourId]/layout";
import TutorialStart from "@/app/tutorial/[tourId]/page";
import { getDb } from "@/db/client";
import { getProductTourState } from "@/db/queries";
import { getSession } from "@/lib/session";

vi.mock("@/lib/session", () => ({ getSession: vi.fn<typeof getSession>() }));
vi.mock("@/db/client", () => ({ getDb: vi.fn<typeof getDb>() }));
vi.mock("@/db/queries", () => ({ getProductTourState: vi.fn<typeof getProductTourState>() }));
vi.mock("@/components/product-tours/tour-experience", () => ({ TourExperience: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

beforeEach(() => vi.resetAllMocks());

describe("tutorial routes", () => {
  it("requires sign-in and keeps demo routes out of search results", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(
      await TutorialLayout({
        params: Promise.resolve({ tourId: "journal" }),
        children: "page auth gate",
      }),
    ).toBe("page auth gate");
    await expect(
      TutorialPage({
        params: Promise.resolve({ tourId: "journal", stepId: "sends" }),
        searchParams: Promise.resolve({ from: "account" }),
      }),
    ).rejects.toThrow("REDIRECT:/sign-in?next=%2Ftutorial%2Fjournal%2Fsends%3Ffrom%3Daccount");
    expect(metadata.robots).toEqual({ index: false });
  });

  it("uses the authenticated account for completion and exit", async () => {
    vi.mocked(getProductTourState).mockResolvedValue({
      returning: false,
      progress: [{ tourId: "journal", version: 1, status: "completed" }],
    });
    vi.mocked(getSession).mockResolvedValue({ user: { id: "signed-in-owner" } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const layout = await TutorialLayout({
      params: Promise.resolve({ tourId: "journal" }),
      children: null,
    });
    expect(getProductTourState).toHaveBeenCalledWith(undefined, "signed-in-owner");
    expect(layout).toMatchObject({ props: { userId: "signed-in-owner", savedVersion: 1 } });
  });

  it("rejects unknown tours and steps while allowing direct links", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "owner" } } as Awaited<
      ReturnType<typeof getSession>
    >);
    await expect(
      TutorialLayout({ params: Promise.resolve({ tourId: "missing" }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      TutorialPage({
        params: Promise.resolve({ tourId: "journal", stepId: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      TutorialPage({
        params: Promise.resolve({ tourId: "journal", stepId: "sends" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeNull();
  });
  it("preserves Account replay when entering through the tour root", async () => {
    await expect(
      TutorialStart({
        params: Promise.resolve({ tourId: "journal" }),
        searchParams: Promise.resolve({ from: "account" }),
      }),
    ).rejects.toThrow("REDIRECT:/tutorial/journal/journal?from=account");
  });

  it("does not carry arbitrary return destinations into sign-in", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(
      TutorialPage({
        params: Promise.resolve({ tourId: "journal", stepId: "account" }),
        searchParams: Promise.resolve({ from: "https://example.com" }),
      }),
    ).rejects.toThrow("REDIRECT:/sign-in?next=%2Ftutorial%2Fjournal%2Faccount");
  });

  it("preserves the update selection through sign-in and root redirects", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(
      TutorialPage({
        params: Promise.resolve({ tourId: "journal", stepId: "sends" }),
        searchParams: Promise.resolve({ mode: "updates" }),
      }),
    ).rejects.toThrow("REDIRECT:/sign-in?next=%2Ftutorial%2Fjournal%2Fsends%3Fmode%3Dupdates");
    await expect(
      TutorialStart({
        params: Promise.resolve({ tourId: "journal" }),
        searchParams: Promise.resolve({ mode: "updates" }),
      }),
    ).rejects.toThrow("REDIRECT:/tutorial/journal/journal?mode=updates");
  });
});
