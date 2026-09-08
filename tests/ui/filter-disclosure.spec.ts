import { test, expect, openStory } from "./story";

test("filter toggle describes its next action and matches the open panel", async ({
  page,
}, info) => {
  await openStory(page, info, "components-filters-sends-toolbar--default");
  await page.getByRole("button", { name: "Expand filters", exact: true }).click();
  const close = page.getByRole("button", { name: "Hide filters", exact: true });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: "Filter options" });
  expect(await close.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    await panel.evaluate((el) => getComputedStyle(el).backgroundColor),
  );
  const colors = await panel.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, border: style.borderTopColor };
  });
  expect(colors.border).not.toBe(colors.background);
  await page.screenshot({ path: info.outputPath("expanded-filter.png"), fullPage: true });
  await close.click();
  await expect(page.getByRole("button", { name: "Expand filters", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
