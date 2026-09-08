import { test, expect, openStory } from "./story";

test("history filters stay local and Journal filters notes", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "patterns-filters--sends");
  await expect(page.getByText("Cedar Slab", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Filter sends" }).fill("cedar crack");
  await expect(page.getByText(/No matching climbs/)).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await openStory(page, testInfo, "patterns-filters--journal");
  await page.getByRole("searchbox", { name: "Filter journal" }).fill("repeaters");
  await expect(page.getByText("Fingerboard", { exact: true })).toBeVisible();
  await expect(page.getByText("Cedar Arete", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(page.getByText(/No matching entries/)).toBeVisible();
});

test("local area filtering happens before pagination", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "patterns-filters--area-climbs");
  await expect(page.getByText("Cedar Slab", { exact: true })).toBeVisible();
  await expect(page.getByText("Cedar Traverse", { exact: true })).toBeVisible();
  await expect(page.getByText(/Coast Range/)).toHaveCount(0);
});
