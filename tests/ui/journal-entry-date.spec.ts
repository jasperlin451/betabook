import { expect, test, openStory } from "./story";

test("date precedes send controls and I don't know appears with I sent for undated sends", async ({
  page,
}, info) => {
  await openStory(page, info, "components-journal-entry-fields--outdoor");
  const sent = page.getByRole("checkbox", { name: "I sent", exact: true });
  const date = page.getByRole("group", { name: "Date", exact: true });
  const unknown = page.getByRole("checkbox", { name: "I don't know", exact: true });
  const sentBox = await sent.boundingBox();
  const dateBox = await date.boundingBox();
  if (!sentBox || !dateBox) throw new Error("Expected visible send and date controls");
  expect(dateBox.y + dateBox.height).toBeLessThan(sentBox.y);
  await expect(unknown).toBeHidden();

  await sent.press("Space");
  // I don't know sits beside the field, vertically aligned with it.
  const unknownLabel = await page.getByText("I don't know", { exact: true }).boundingBox();
  if (!unknownLabel) throw new Error("Expected a visible I don't know control");
  expect(unknownLabel.x).toBeGreaterThan(dateBox.x + dateBox.width);
  expect(
    Math.abs(unknownLabel.y + unknownLabel.height / 2 - (dateBox.y + dateBox.height / 2)),
  ).toBeLessThan(3);

  await unknown.press("Space");
  await expect(unknown).toBeChecked();
  await expect(page.getByRole("button", { name: "Save send" })).toBeVisible();
  await info.attach("undated-send", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});
