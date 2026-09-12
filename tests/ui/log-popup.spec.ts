import { expect, test, openStory } from "./story";

for (const story of ["training", "climb", "send", "repeat"]) {
  test(`Log ${story} uses a centered popup with the save button on the right`, async ({
    page,
  }, info) => {
    await openStory(page, info, `components-journal-log-popup--${story}`);
    const dialog = page.getByRole("dialog", { name: "Log entry" });
    const save = dialog.getByRole("button", { name: /^Save (entry|send)$/ });
    const box = await dialog.boundingBox();
    const action = await save.boundingBox();
    const form = await dialog.locator("form").boundingBox();
    const viewport = page.viewportSize();
    if (!box || !action || !form || !viewport) throw new Error("Expected log popup geometry");
    expect(box.width).toBeLessThanOrEqual(512);
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(action.x + action.width - form.x - form.width)).toBeLessThanOrEqual(2);
    expect(action.width).toBeLessThan(form.width / 2);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2);
    await save.scrollIntoViewIfNeeded();
    const visibleAction = await save.boundingBox();
    if (!visibleAction) throw new Error("Expected reachable save action");
    expect(visibleAction.y).toBeGreaterThanOrEqual(0);
    expect(visibleAction.y + visibleAction.height).toBeLessThanOrEqual(viewport.height);
    await expect(save).toBeVisible();
  });
}

test("Log launcher keeps standard spacing after closing the popup", async ({ page }, info) => {
  await openStory(page, info, "components-journal-log-popup--choose-entry");
  await page
    .getByRole("dialog", { name: "Log entry" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const heading = await page
    .getByRole("heading", { name: "Log an entry", exact: true })
    .boundingBox();
  const button = await page.getByRole("button", { name: "Log", exact: true }).boundingBox();
  if (!heading || !button) throw new Error("Expected closed popup launcher");
  expect(button.y - heading.y - heading.height).toBe(24);
  expect(button.x).toBe(heading.x);
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Log entry" })).toBeVisible();
});
