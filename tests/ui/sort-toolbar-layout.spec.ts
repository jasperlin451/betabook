import { test, expect, openStory } from "./story";

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`sort stays right aligned at ${width}px with its label beside the field`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await openStory(page, info, "components-filters-sends-toolbar--responsive");
    const toolbar = page.getByRole("group", { name: "Filter controls", exact: true });
    const label = page.getByText("Sort by", { exact: true });
    const sort = page.getByRole("button", { name: "Date Sort by", exact: true });
    const direction = page.getByRole("button", { name: "Sort descending", exact: true });
    await expect(label).toHaveCSS("font-size", "12px");
    const [bounds, field, arrow, title] = await Promise.all([
      toolbar.boundingBox(),
      sort.boundingBox(),
      direction.boundingBox(),
      label.boundingBox(),
    ]);
    if (!bounds || !field || !arrow || !title) throw new Error("Missing toolbar geometry");
    expect(field.width).toBe(112);
    expect(arrow.x + arrow.width).toBeCloseTo(bounds.x + bounds.width);
    expect(title.x + title.width).toBeLessThanOrEqual(field.x);
    expect(title.y + title.height / 2).toBeCloseTo(field.y + field.height / 2);
    expect(arrow.y).toBeCloseTo(field.y);
    expect(title.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
    await page.getByRole("button", { name: "Expand filters", exact: true }).click();
    const panel = page.getByRole("region", { name: "Filter options", exact: true });
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        const labelBox = await label.boundingBox();
        return Boolean(box && labelBox && labelBox.y >= box.y + box.height);
      })
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: info.outputPath(`sort-toolbar-${width}.png`), fullPage: true });
  });
}
