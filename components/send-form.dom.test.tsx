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

it("collapses the opinion fields for a send without opinions and submits the climb's grade", async () => {
  const { user, save, onDone } = setup();
  const details = screen.getByRole("button", { name: "Your opinion" });
  expect(details).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: /Suggested grade/ })).not.toBeInTheDocument();
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

it("opens the opinion fields when the send records one and submits edits to them", async () => {
  const { user, save } = setup({ rating: 4, suggestedGrade: 6, gradeFeel: "high" });
  expect(screen.getByRole("button", { name: "Your opinion" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Low end" }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const [, form] = save.mock.calls[0];
  expect(form.get("rating")).toBe("4");
  expect(form.get("suggestedGrade")).toBe("6");
  expect(form.get("gradeFeel")).toBe("low");
});
