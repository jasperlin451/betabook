import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { importSends, resolveImportClimbs } from "@/actions";

import { ImportWizard } from "./import-wizard";

vi.mock("@/actions", () => ({
  resolveImportClimbs: vi.fn<typeof resolveImportClimbs>().mockResolvedValue({
    ok: true,
    value: [
      {
        id: 1,
        areaId: 2,
        name: "Test climb",
        key: "test climb",
        type: "sport",
        grade: 18,
        sendCount: 1,
        areaName: "Wall",
        ancestors: [],
        total: 1,
      },
    ],
  }),
  importSends: vi.fn<typeof importSends>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn<() => void>() }),
  usePathname: () => "/account/import",
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
});

it("takes public API data straight to matching and review without writing sends", async () => {
  const envelope = (json: unknown) => Response.json({ result: { data: { json } } });
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        envelope({ profile: { id: 42, slug: "climber", isPrivate: false, totalSends: 1 } }),
      )
      .mockResolvedValueOnce(
        envelope({
          items: [
            {
              climb: {
                id: 100,
                name: "Test climb",
                type: "sport",
                gradeId: 62,
                area: { name: "Wall" },
              },
              userSend: {
                id: 200,
                sendType: "redpoint",
                gradeId: 62,
                day: "2026-08-16",
                rating: 5,
                difficulty: 0,
                comments: "Great &amp; sunny",
              },
            },
          ],
        }),
      ),
  );
  render(<ImportWizard profileHref="/users/local" />);
  await userEvent.type(screen.getByRole("textbox"), "climber");
  await userEvent.click(screen.getByRole("button", { name: "Import from Sendage" }));
  await waitFor(() => expect(resolveImportClimbs).toHaveBeenCalledExactlyOnceWith(["Test climb"]));
  expect(screen.getByText(/Sendage profile @climber/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Next: Review" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Next: Review" }));
  expect(screen.getByText("Will import").parentElement).toHaveTextContent("1");
  expect(importSends).not.toHaveBeenCalled();
});
