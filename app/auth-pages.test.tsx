import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";

const sessionState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

const mockRedirect = vi.hoisted(() => vi.fn<(url: string) => void>());

const mockSignInForm = vi.hoisted(() =>
  vi.fn<(props: { next?: string; googleEnabled?: boolean; initialError?: string | null }) => null>(
    () => null,
  ),
);
const mockSignUpForm = vi.hoisted(() =>
  vi.fn<(props: { next?: string; googleEnabled?: boolean }) => null>(() => null),
);
const mockIsGoogleOAuthEnabled = vi.hoisted(() => vi.fn<() => Promise<boolean>>(async () => true));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn<() => Promise<{ user: { id: string } } | null>>(
    async () => sessionState.session,
  ),
}));

vi.mock("@/lib/auth", () => ({
  isGoogleOAuthEnabled: mockIsGoogleOAuthEnabled,
}));

vi.mock("@/components/sign-in-form", () => ({
  SignInForm: mockSignInForm,
}));

vi.mock("@/components/sign-up-form", () => ({
  SignUpForm: mockSignUpForm,
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
    const element = result as React.ReactElement<{
      next?: string;
      googleEnabled: boolean;
      initialError?: string;
    }>;
    expect(element.props.googleEnabled).toBe(true);
    expect(element.props.initialError).toBeUndefined();
    expect(element.props.next).toBeUndefined();
  });

  it("passes next path to the sign-in form for unauthenticated users", async () => {
    sessionState.session = null;

    const result = await SignInPage({
      searchParams: Promise.resolve({ next: "/account/import" }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    const element = result as React.ReactElement<{ next?: string; googleEnabled: boolean }>;
    expect(element.props.next).toBe("/account/import");
    expect(element.props.googleEnabled).toBe(true);
  });

  it("passes formatted OAuth error to the sign-in form when error param is present", async () => {
    sessionState.session = null;

    const result = await SignInPage({
      searchParams: Promise.resolve({ error: "access_denied" }),
    });

    const element = result as React.ReactElement<{ googleEnabled: boolean; initialError?: string }>;
    expect(element.props.googleEnabled).toBe(true);
    expect(element.props.initialError).toBe("Google sign-in was cancelled.");
  });

  it("passes googleEnabled: false when Google OAuth credentials are not set", async () => {
    sessionState.session = null;
    mockIsGoogleOAuthEnabled.mockResolvedValueOnce(false);

    const result = await SignInPage({
      searchParams: Promise.resolve({}),
    });

    const element = result as React.ReactElement<{ googleEnabled: boolean }>;
    expect(element.props.googleEnabled).toBe(false);
  });
});

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
    mockIsGoogleOAuthEnabled.mockResolvedValue(true);
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
    const element = result as React.ReactElement<{ next?: string; googleEnabled: boolean }>;
    expect(element.props.googleEnabled).toBe(true);
    expect(element.props.next).toBeUndefined();
  });

  it("passes next path to the sign-up form for unauthenticated users", async () => {
    sessionState.session = null;

    const result = await SignUpPage({
      searchParams: Promise.resolve({ next: "/climbs/new" }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    const element = result as React.ReactElement<{ next?: string; googleEnabled: boolean }>;
    expect(element.props.next).toBe("/climbs/new");
    expect(element.props.googleEnabled).toBe(true);
  });

  it("passes googleEnabled: false to the sign-up form when Google OAuth is disabled", async () => {
    sessionState.session = null;
    mockIsGoogleOAuthEnabled.mockResolvedValueOnce(false);

    const result = await SignUpPage({
      searchParams: Promise.resolve({}),
    });

    const element = result as React.ReactElement<{ googleEnabled: boolean }>;
    expect(element.props.googleEnabled).toBe(false);
  });
});
