import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { DEFAULT_JOURNAL_FILTER } from "@/lib/filters/journal-filter";

import { JournalFilterToolbar } from "./journal-filter-toolbar";

const router = vi.hoisted(() => ({
  replace: vi.fn<(href: string, options: { scroll: boolean }) => void>(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

it("preserves hashtags across disclosure changes and clears them on reset", async () => {
  const user = userEvent.setup();
  render(
    <JournalFilterToolbar
      userId="alex"
      filter={DEFAULT_JOURNAL_FILTER}
      climbName={null}
      tags={["power", "trip"]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Expand filters" }));
  const input = screen.getByRole("combobox", { name: "Tags" });
  await user.type(input, "power ");
  await user.click(screen.getByRole("button", { name: "Hide filters" }));
  await user.click(screen.getByRole("button", { name: "Expand filters" }));
  expect(screen.getByRole("button", { name: "Remove tag power" })).toBeInTheDocument();
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/users/alex/journal?tag=power", { scroll: false }),
  );
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(screen.queryByRole("button", { name: "Remove tag power" })).not.toBeInTheDocument();
});
it("keeps text filtering local and builds view links from the entered filter", async () => {
  const user = userEvent.setup();
  render(
    <JournalFilterToolbar
      userId="alex"
      filter={DEFAULT_JOURNAL_FILTER}
      climbName={null}
      tags={[]}
    />,
  );
  await user.type(screen.getByRole("searchbox", { name: "Filter journal" }), "repeaters");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sessions" })).toHaveAttribute(
    "href",
    "/users/alex/journal?view=sessions&q=repeaters",
  );
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/users/alex/journal?q=repeaters", {
      scroll: false,
    }),
  );
});
