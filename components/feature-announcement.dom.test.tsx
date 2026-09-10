import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/action-result";

import { FeatureAnnouncement } from "./feature-announcement";

vi.mock("@/actions/feature-announcements", () => ({
  dismissFeatureAnnouncement: vi.fn<(featureId: string) => Promise<ActionResult>>(),
}));
const base = {
  userId: "one",
  featureId: "journal-tags",
  title: "Organize your journal",
  description: "Find sessions with tags.",
  initialDismissed: false,
  children: <button type="button">Tags</button>,
};

describe("feature announcements", () => {
  it("stays open until a successful explicit dismissal, prevents duplicate saves, and preserves its target", async () => {
    const user = userEvent.setup();
    let resolve!: (result: ActionResult) => void;
    const save = vi.fn<(featureId: string) => Promise<ActionResult>>(
      () =>
        new Promise<ActionResult>((done) => {
          resolve = done;
        }),
    );
    render(<FeatureAnnouncement {...base} dismissAction={save} />);
    await user.click(screen.getByRole("button", { name: "Tags" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: base.title })).toBeVisible();
    const close = screen.getByRole("button", { name: /Dismiss announcement/ });
    await user.click(close);
    await user.click(close);
    expect(save).toHaveBeenCalledExactlyOnceWith("journal-tags");
    expect(screen.getByRole("heading", { name: base.title })).toBeVisible();
    resolve({ ok: true, value: undefined });
    await waitFor(() => expect(screen.queryByRole("heading")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Tags" })).toBeVisible();
  });
  it("keeps failed dismissals visible and allows retry", async () => {
    const user = userEvent.setup();
    const save = vi
      .fn<(featureId: string) => Promise<ActionResult>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, value: undefined });
    render(<FeatureAnnouncement {...base} dismissAction={save} />);
    await user.click(screen.getByRole("button", { name: /Dismiss announcement/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try dismissing again");
    await user.click(screen.getByRole("button", { name: /Dismiss announcement/ }));
    await waitFor(() => expect(screen.queryByRole("heading")).not.toBeInTheDocument());
  });
  it("honors stored dismissal and resets local state for a different account or feature", async () => {
    const user = userEvent.setup();
    const save = vi
      .fn<(featureId: string) => Promise<ActionResult>>()
      .mockResolvedValue({ ok: true, value: undefined });
    const view = render(<FeatureAnnouncement {...base} initialDismissed dismissAction={save} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    view.rerender(<FeatureAnnouncement {...base} dismissAction={save} />);
    await user.click(screen.getByRole("button", { name: /Dismiss announcement/ }));
    await waitFor(() => expect(screen.queryByRole("heading")).not.toBeInTheDocument());
    view.rerender(<FeatureAnnouncement {...base} userId="two" dismissAction={save} />);
    expect(screen.getByRole("heading")).toBeVisible();
  });
});
