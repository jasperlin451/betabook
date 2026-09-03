import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";

const sessionState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

const mockRedirect = vi.hoisted(() => vi.fn<(url: string) => void>());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn<() => Promise<{ user: { id: string } } | null>>(
    async () => sessionState.session,
  ),
}));

vi.mock("@/components/sign-in-form", () => ({
  SignInForm: () => null,
}));

vi.mock("@/components/sign-up-form", () => ({
  SignUpForm: () => null,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
  });

  it("redirects an authenticated user to their own page by default", async () => {
    sessionState.session = { user: { id: "climber-123" } };

    await SignInPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/users/climber-123");
  });

  it("redirects an authenticated user to the safe next path if specified", async () => {
    sessionState.session = { user: { id: "climber-123" } };

    await SignInPage({
      searchParams: Promise.resolve({ next: "/areas/new" }),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/areas/new");
  });

  it("renders the sign-in form for unauthenticated users", async () => {
    sessionState.session = null;

    const result = await SignInPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
  });

  it("redirects an authenticated user to their own page by default", async () => {
    sessionState.session = { user: { id: "climber-123" } };

    await SignUpPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/users/climber-123");
  });

  it("redirects an authenticated user to the safe next path if specified", async () => {
    sessionState.session = { user: { id: "climber-123" } };

    await SignUpPage({
      searchParams: Promise.resolve({ next: "/climbs/new" }),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/climbs/new");
  });

  it("renders the sign-up form for unauthenticated users", async () => {
    sessionState.session = null;

    const result = await SignUpPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
