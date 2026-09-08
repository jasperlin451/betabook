import { test, expect, openStory } from "./story";

for (const toolbar of ["sends", "journal"]) {
  test(`${toolbar} filter fields share alignment and widths`, async ({ page }, info) => {
    await openStory(page, info, `components-filters-${toolbar}-toolbar--default`);
    await page.getByRole("button", { name: /^(Expand|Hide) filters$/ }).click();
    const dates = page.getByRole("button", { name: "All time Dates", exact: true });
    const hashtag = page.getByRole("combobox", { name: "Tags", exact: true });
    await expect(dates).toBeVisible();
    await expect(hashtag).toBeVisible();
    const dateBox = await dates.boundingBox();
    const tagBox = await hashtag.boundingBox();
    if (!dateBox || !tagBox) throw new Error("Missing filter bounds");
    expect(Math.abs(dateBox.x - tagBox.x)).toBeLessThan(2);
    expect(tagBox.width).toBe(176);
    if (toolbar === "sends") {
      const area = page.getByRole("combobox", { name: "Filter by area", exact: true });
      await expect(area).toHaveAttribute("placeholder", "Filter by area…");
      await expect(page.getByText("Filter by area", { exact: true })).toHaveCount(0);
      const areaBox = await area.boundingBox();
      if (!areaBox) throw new Error("Missing area bounds");
      expect(Math.abs(areaBox.x - tagBox.x)).toBeLessThan(2);
      if (!areaBox) throw new Error("Missing area bounds");
      expect(areaBox.width).toBeGreaterThan(tagBox.width);
    }
    await page.screenshot({
      path: info.outputPath(`${toolbar}-filters.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("standard short, medium and long fields use the shared widths", async ({ page }, info) => {
  await openStory(page, info, "patterns-fields-standard-widths--comparison");
  const short = await page.getByRole("button", { name: "V0 Min grade", exact: true }).boundingBox();
  const medium = await page
    .getByRole("button", { name: "All time Dates", exact: true })
    .boundingBox();
  const long = await page
    .getByRole("group")
    .filter({ has: page.getByRole("searchbox", { name: "Filter sends" }) })
    .boundingBox();
  if (!short || !medium || !long) throw new Error("Missing standard fields");
  expect(short.width).toBe(112);
  expect(medium.width).toBe(176);
  expect(long.width).toBe(Math.min(384, (info.project.use.viewport?.width ?? 1024) - 32));
  await page.screenshot({
    path: info.outputPath("standard-fields.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("compact medium fields fit custom dates without clipping", async ({ page }, info) => {
  await openStory(page, info, "components-filters-date-filter--any");
  await page.getByRole("button", { name: "All time Dates" }).click();
  await page.getByRole("option", { name: "Custom dates", exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  const date = page.getByRole("group", { name: "Start date", exact: true });
  const year = date.getByRole("spinbutton", { name: /year/ });
  const calendar = date.getByRole("button", { name: "Calendar Start date" });
  const yearBox = await year.boundingBox();
  const calendarBox = await calendar.boundingBox();
  if (!yearBox || !calendarBox) throw new Error("Missing date controls");
  expect(yearBox.x + yearBox.width).toBeLessThanOrEqual(calendarBox.x);
  expect(await year.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath("compact-dates.png"),
    fullPage: true,
    animations: "disabled",
  });
});
