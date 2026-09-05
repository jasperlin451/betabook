import { beforeEach, describe, expect, it, vi } from "vitest";

import TutorialPage from "@/app/tutorial/[tourId]/[stepId]/page";
import TutorialLayout, { metadata } from "@/app/tutorial/[tourId]/layout";
import { getSession } from "@/lib/session";

vi.mock("@/lib/session", () => ({ getSession: vi.fn<typeof getSession>() }));
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
    await expect(
      TutorialLayout({ params: Promise.resolve({ tourId: "journal" }), children: null }),
    ).rejects.toThrow("REDIRECT:/sign-in");
    expect(metadata.robots).toEqual({ index: false });
  });

  it("uses the authenticated account for completion and exit", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "signed-in-owner" } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const layout = await TutorialLayout({
      params: Promise.resolve({ tourId: "journal" }),
      children: null,
    });
    expect(layout.props.userId).toBe("signed-in-owner");
  });

  it("rejects unknown tours and steps while allowing direct links", async () => {
    await expect(
      TutorialLayout({ params: Promise.resolve({ tourId: "missing" }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      TutorialPage({ params: Promise.resolve({ tourId: "journal", stepId: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      TutorialPage({ params: Promise.resolve({ tourId: "journal", stepId: "sends" }) }),
    ).resolves.toBeNull();
  });
});
