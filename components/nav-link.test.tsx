import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavLink } from "@/components/nav-link";

const state = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("@/components/ui/app-link", () => ({
  AppLink: (props: Record<string, unknown>) => props,
}));

describe("NavLink", () => {
  beforeEach(() => {
    state.pathname = "/";
  });

  it("hides a current-page shortcut when requested", () => {
    state.pathname = "/users/alice";
    expect(NavLink({ href: "/users/alice", hideWithin: true })).toBeNull();
  });

  it("hides the shortcut within that section", () => {
    state.pathname = "/users/alice/sends";
    expect(NavLink({ href: "/users/alice", hideWithin: true })).toBeNull();
  });

  it("keeps the shortcut on another user's profile", () => {
    state.pathname = "/users/bob";
    const result = NavLink({ href: "/users/alice", hideWithin: true }) as ReactElement<{
      href: string;
    }>;
    expect(result.props.href).toBe("/users/alice");
  });
});
