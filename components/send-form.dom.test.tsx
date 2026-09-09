import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { updateSend } from "@/actions";
import type { EditableSend, SendableClimb } from "@/db/queries";
import type { ActionResult } from "@/lib/action-result";

import { SendForm } from "./send-form";

vi.mock("@/actions", () => ({
  updateSend: vi.fn<(id: number, formData: FormData) => Promise<ActionResult>>(),
}));

const climb: SendableClimb = { id: 17, areaId: 3, type: "boulder", grade: 5 };
const send: EditableSend = {
  id: 91,
  ascentStyle: "redpoint",
  dateSent: "2026-08-30",
  comment: null,
  rating: null,
  suggestedGrade: null,
  gradeFeel: "solid",
};

function setup(overrides: Partial<EditableSend> = {}) {
  const save = vi.mocked(updateSend).mockResolvedValue({ ok: true, value: undefined });
  save.mockClear();
  const onDone = vi.fn<() => void>();
  render(<SendForm climb={climb} existingSend={{ ...send, ...overrides }} onDone={onDone} />);
  return { user: userEvent.setup(), save, onDone };
}

it("shows the opinion fields and submits the climb's grade for a send without a suggestion", async () => {
  const { user, save, onDone } = setup();
  expect(screen.getByRole("button", { name: /Suggested grade/ })).toBeVisible();
  expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledOnce();
  const [id, form] = save.mock.calls[0];
  expect(id).toBe(91);
  expect(form.get("ascentStyle")).toBe("redpoint");
  expect(form.get("dateSent")).toBe("2026-08-30");
  expect(form.get("rating")).toBe("");
  expect(form.get("suggestedGrade")).toBe("5");
  expect(form.get("gradeFeel")).toBe("solid");
});

it("clears the sent date to make the send undated", async () => {
  const { user, save } = setup();
  await user.click(screen.getByRole("button", { name: "Clear date sent" }));
  expect(screen.queryByRole("button", { name: "Clear date sent" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][1].get("dateSent")).toBe("");
});

it("submits edits to a recorded opinion", async () => {
  const { user, save } = setup({ rating: 4, suggestedGrade: 6, gradeFeel: "high" });
  expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Low end" }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const [, form] = save.mock.calls[0];
  expect(form.get("rating")).toBe("4");
  expect(form.get("suggestedGrade")).toBe("6");
  expect(form.get("gradeFeel")).toBe("low");
});
