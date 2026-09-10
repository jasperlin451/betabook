import { expect, openStory, test } from "./story";

for (const story of [
  "components-feature-callout--default",
  "components-feature-callout--near-right-edge",
]) {
  test(`${story} keeps its callout and touch target within the viewport`, async ({
    page,
  }, info) => {
    await openStory(page, info, story);
    const callout = page.getByRole("region", { name: "Your journal, organized" });
    await expect(callout).toBeVisible();
    const bounds = await callout.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = page.viewportSize();
    if (!bounds || !viewport) throw new Error("Missing callout or viewport bounds");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    const close = page.getByRole("button", { name: /Dismiss announcement:/ });
    const closeBounds = await close.boundingBox();
    if (!closeBounds) throw new Error("Missing dismiss button bounds");
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(closeBounds.height).toBeGreaterThanOrEqual(44);
  });
}

test("dismissal is reachable with touch and keyboard", async ({ page }, info) => {
  await openStory(page, info, "components-feature-announcement--undismissed");
  const close = page.getByRole("button", { name: /Dismiss announcement:/ });
  if (info.project.use.hasTouch) await close.tap();
  else {
    for (
      let i = 0;
      i < 10 && !(await close.evaluate((element) => element === document.activeElement));
      i += 1
    )
      await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(close).toBeHidden();
  await expect(page.getByRole("button", { name: "Journal tags" })).toBeVisible();
});

test("analytics announcement fits the screen and leaves Customize usable", async ({
  page,
}, info) => {
  await openStory(page, info, "components-charts-analytics-dashboard--customize-announcement");
  const callout = page.getByRole("region", { name: "Make Analytics your own" });
  await expect(callout).toBeVisible();
  const bounds = await callout.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error("Missing announcement bounds");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  const customize = page.getByRole("button", { name: "Customize dashboard" });
  if (info.project.use.hasTouch) await customize.tap();
  else await customize.click();
  await expect(
    page.getByRole("heading", { name: "Customize your analytics dashboard" }),
  ).toBeVisible();
});
