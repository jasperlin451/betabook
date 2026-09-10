import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { nativeGradeArray } from "@/lib/grades";

import { ClimbForm } from "./climb-form";

vi.mock("@/actions", () => ({
  createClimb: vi.fn<typeof import("@/actions").createClimb>(),
  updateClimb: vi.fn<typeof import("@/actions").updateClimb>(),
}));

it("selects exactly one discipline and resets the grade when it changes", async () => {
  const user = userEvent.setup();
  render(<ClimbForm areaId={1} />);
  expect(screen.getByRole("radio", { name: "Boulder" })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: "Sport" }));
  expect(screen.getByRole("radio", { name: "Sport" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Boulder" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: "Trad" })).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: /Grade$/ }));
  await user.click(screen.getByRole("option", { name: nativeGradeArray("sport")[3] }));
  await user.click(screen.getByRole("radio", { name: "Boulder" }));
  expect(screen.getByRole("button", { name: /Grade$/ })).toHaveTextContent(
    nativeGradeArray("boulder")[0],
  );
  expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
});
