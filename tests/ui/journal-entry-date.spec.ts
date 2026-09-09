import { expect, test, openStory } from "./story";

test("date precedes send controls and clearing it reveals the undated-send layout", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  const sent = page.getByRole("checkbox", { name: "I sent", exact: true });
  const date = page.getByRole("group", { name: "Date", exact: true });
  const sentBox = await sent.boundingBox();
  const dateBox = await date.boundingBox();
  if (!sentBox || !dateBox) throw new Error("Expected visible send and date controls");
  expect(dateBox.y + dateBox.height).toBeLessThan(sentBox.y);

  // Clear sits beside the field, vertically aligned with it.
  const clear = page.getByRole("button", { name: "Clear date", exact: true });
  const clearBox = await clear.boundingBox();
  if (!clearBox) throw new Error("Expected a visible clear control");
  expect(clearBox.x).toBeGreaterThan(dateBox.x + dateBox.width);
  expect(
    Math.abs(clearBox.y + clearBox.height / 2 - (dateBox.y + dateBox.height / 2)),
  ).toBeLessThan(3);

  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(clear).toBeHidden();
  await sent.press("Space");
  await expect(page.getByRole("button", { name: "Save send" })).toBeVisible();
  await info.attach("undated-send", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});
