import { expect, test, openStory } from "./story";

test("collapsed goal panel has equal top and bottom padding", async ({ page }, info) => {
  await openStory(page, info, "components-goals-journal-goals--shared-journal");
  const panel = page.locator('[data-slot="disclosure"]').first();
  const trigger = panel.getByRole("button", { name: /^Goals/ });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(async () => {
      const outer = await panel.boundingBox();
      const inner = await trigger.boundingBox();
      if (!outer || !inner) throw new Error("Expected visible goal header");
      return Math.abs(inner.y - outer.y - (outer.y + outer.height - inner.y - inner.height));
    })
    .toBeLessThanOrEqual(1);
});

test("goal progress track remains visible in dark mode", async ({ page }, info) => {
  await openStory(page, info, "components-goals-journal-goals--shared-journal");
  if (info.project.name.endsWith("dark")) {
    await expect(page.getByRole("progressbar")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  } else {
    await expect(page.getByRole("progressbar")).toBeVisible();
  }
});

test("goal rows begin directly below the tabs without extra first-row padding", async ({
  page,
}, info) => {
  await openStory(page, info, "components-goals-journal-goals--shared-journal");
  const nav = await page.getByRole("navigation", { name: "Goal views" }).boundingBox();
  const row = await page.locator(".divide-y > div").first().boundingBox();
  if (!nav || !row) throw new Error("Expected goals navigation and first row");
  expect(Math.abs(row.y - nav.y - nav.height)).toBeLessThanOrEqual(1);
});

test("goal heading and action stay above the collapsible surface", async ({ page }, info) => {
  await openStory(page, info, "components-goals-goal-section--expanded");
  const trigger = page.getByRole("button", { name: /^Your goals/ });
  const action = page.getByRole("button", { name: "Set goal" });
  const content = page.getByText("Log 8 training sessions");
  const headerBox = await trigger.boundingBox();
  const actionBox = await action.boundingBox();
  const contentBox = await content.boundingBox();
  if (!headerBox || !actionBox || !contentBox) throw new Error("Expected goal section");
  expect(contentBox.y).toBeGreaterThan(headerBox.y + headerBox.height);
  expect(contentBox.y).toBeGreaterThan(actionBox.y + actionBox.height);
  await expect(trigger).toHaveCSS("font-size", "12px");
  await trigger.click();
  await expect(content).not.toBeVisible();
  await expect(action).toBeVisible();
});

test("a cross-year goal range wraps below its title on mobile without overlap", async ({
  page,
}, info) => {
  await openStory(page, info, "components-goals-journal-goals--cross-year-season");
  const title = await page
    .getByText("Send 8 climbs at V4 or harder", { exact: true })
    .boundingBox();
  const date = await page.getByText("Dec 1, 2026 – Feb 28, 2027", { exact: true }).boundingBox();
  if (!title || !date) throw new Error("Expected goal title and seasonal range");
  if (info.project.name.startsWith("mobile"))
    expect(date.y).toBeGreaterThanOrEqual(title.y + title.height);
  else expect(date.x).toBeGreaterThan(title.x + title.width);
});

test("met recurring goals align the reset with the progress row", async ({ page }, info) => {
  await openStory(page, info, "components-goals-journal-goals--monthly-target-met");
  await expect(page.getByRole("progressbar")).toBeVisible();
  const period = await page.locator("[data-goal-date]").boundingBox();
  const reset = await page.getByText("Resets Oct 1", { exact: true }).boundingBox();
  if (!period || !reset) throw new Error("Expected period and reset labels");
  const progress = await page.getByRole("progressbar").boundingBox();
  if (!progress) throw new Error("Expected progress bar");
  expect(
    Math.abs(reset.y + reset.height / 2 - progress.y - progress.height / 2),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(reset.x + reset.width - period.x - period.width)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "See history" })).toHaveCount(0);
});
