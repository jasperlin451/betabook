import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

async function openHashtagStory(page: Page, testInfo: TestInfo) {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=components-inputs-hashtag-filter--default&viewMode=story&globals=theme:${theme}`,
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  return page.getByRole("combobox", { name: "Hashtag" });
}

test("hashtag only commits existing tags with Enter or Space", async ({ page }, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  const status = page.locator('p[role="status"]');
  await expect(input).toHaveValue("#");
  await input.press("Enter");
  await input.press("Space");
  await expect(status).toHaveText("Filter: All hashtags");
  await expect(page.getByRole("button", { name: /^Remove hashtag/ })).toHaveCount(0);
  for (const key of ["Enter", "Space"]) {
    await input.fill("#UNLISTED");
    await expect(status).toHaveText("Filter: All hashtags");
    await input.press(key);
    await expect(status).toHaveText("Filter: All hashtags");
    await expect(input).toHaveValue("#UNLISTED");
    await input.fill("#TRIP");
    await input.press(key);
    await expect(input).toHaveValue("#");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(status).toHaveText("Filter: trip");
    const selected = page.getByRole("button", { name: "Remove hashtag trip" });
    await expect(selected).toHaveText("#trip");
    await input.fill("#missing");
    await input.press(key);
    await expect(status).toHaveText("Filter: trip");
    await input.press("Escape");
    await selected.click();
    await expect(status).toHaveText("Filter: All hashtags");
    await expect(selected).toHaveCount(0);
  }
});

test("hashtag suggestions select a removable tag and keep the # prefix", async ({
  page,
}, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.fill("");
  await expect(input).toHaveValue("#");
  await input.fill("#TRI");
  await expect(page.getByRole("option", { name: "#trip", exact: true })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("#");
  await expect(
    page.getByRole("button", { name: "Remove hashtag trip", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await input.fill("#project");
  await page.getByRole("option", { name: "#project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove hashtag project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove hashtag trip", exact: true })).toHaveCount(
    1,
  );
  await expect(input).toHaveValue("#");
  await expect(page.getByText("No matching hashtags.", { exact: true })).toHaveCount(0);
  const screenshot = testInfo.outputPath("hashtag-selected.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("hashtag-selected", { path: screenshot, contentType: "image/png" });
  await input.fill("#trip");
  await input.press("Space");
  await expect(page.getByRole("button", { name: /^Remove hashtag/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Remove hashtag trip", exact: true }).click();
  await expect(page.locator('p[role="status"]')).toHaveText("Filter: project");
  await expect(page.getByRole("button", { name: "Remove hashtag project" })).toBeVisible();
});

test("the caret and text selection stay after the hashtag prefix", async ({ page }, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.fill("#trip");
  await input.press("Home");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.press("ArrowLeft");
  await input.press("Backspace");
  await expect(input).toHaveValue("#trip");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("a");
  await expect(input).toHaveValue("#atrip");
  await input.press("End");
  await input.press("Shift+Home");
  await expect
    .poll(() =>
      input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
    )
    .toEqual([1, 6]);
  await input.press("Backspace");
  await expect(input).toHaveValue("#");
  await input.fill("#trip");
  await input.press("Escape");
  await input.click({ position: { x: 4, y: 15 } });
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("a");
  await expect(input).toHaveValue("#atrip");
  await input.press("ControlOrMeta+a");
  await expect.poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(1);
  await input.pressSequentially("project");
  await expect(input).toHaveValue("#project");
});

test("clicking the field shows every available hashtag and reopens after selection", async ({
  page,
}, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await input.click();
  await expect(page.getByRole("option")).toHaveCount(7);
  await expect(page.getByRole("option", { name: "#outdoors", exact: true })).toBeVisible();
  await input.press("ArrowUp");
  await expect
    .poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart))
    .toBeGreaterThanOrEqual(1);
  await page.getByRole("option", { name: "#outdoors", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove hashtag outdoors" })).toBeVisible();
  await input.click();
  await expect(page.getByRole("option")).toHaveCount(6);
  await input.fill("#tri");
  await expect(page.getByRole("option")).toHaveCount(2);
  await input.fill("#missing");
  await input.press("Escape");
  await input.press("ArrowUp");
  await expect
    .poll(() => input.evaluate((node: HTMLInputElement) => node.selectionStart))
    .toBeGreaterThanOrEqual(1);
  await input.fill("#");
  await input.click();
  await expect(page.getByRole("option")).toHaveCount(6);
  const screenshot = testInfo.outputPath("hashtag-browse.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("hashtag-browse", { path: screenshot, contentType: "image/png" });
});

test("hashtag field has no search icon", async ({ page }, testInfo) => {
  const input = await openHashtagStory(page, testInfo);
  await expect(input).toHaveCSS("background-image", "none");
});

for (const scenario of [
  {
    name: "Journal",
    story: "components-journal-filter-toolbar--default",
    role: "searchbox" as const,
    label: "Search journal",
  },
  {
    name: "Sends toolbar",
    story: "components-inputs-filter-toolbar--hashtags",
    role: "textbox" as const,
    label: "Search routes",
  },
]) {
  test(`${scenario.name} search stays anchored as selected hashtags wrap below the field`, async ({
    page,
  }, testInfo) => {
    const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
    await page.goto(`/iframe.html?id=${scenario.story}&viewMode=story&globals=theme:${theme}`);
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    const search = page.getByRole(scenario.role, { name: scenario.label });
    const hashtag = page.getByRole("combobox", { name: "Hashtag" });
    await expect(hashtag).toBeVisible();
    const before = await search.boundingBox();
    const hashtagBefore = await hashtag.boundingBox();
    for (const tag of ["power", "strength", "trip"]) {
      await hashtag.fill(`#${tag}`);
      await hashtag.press("Space");
      await expect(
        page.getByRole("button", { name: `Remove hashtag ${tag}`, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("listbox")).toHaveCount(0);
    expect((await search.boundingBox())?.y).toBe(before?.y);
    expect((await hashtag.boundingBox())?.y).toBe(hashtagBefore?.y);
    const screenshot = testInfo.outputPath("hashtag-toolbar-wrapped.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("hashtag-toolbar-wrapped", {
      path: screenshot,
      contentType: "image/png",
    });
  });
}

test("Journal keeps hashtags inside More filters and preserves selections when collapsed", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=components-journal-filter-toolbar--default&viewMode=story");
  const input = page.getByRole("combobox", { name: "Hashtag", exact: true });
  await expect(input).toBeHidden();
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await input.fill("#power");
  await input.press("Space");
  await page.getByRole("button", { name: "Fewer filters", exact: true }).click();
  await expect(input).toBeHidden();
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove hashtag power", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove hashtag power", exact: true })).toHaveCount(
    0,
  );
});

test("Journal and route search boxes use the same field height", async ({ page }, testInfo) => {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=components-inputs-search-combobox--search&viewMode=story&globals=theme:${theme}`,
  );
  const route = page.getByRole("combobox", { name: "Find a climb" });
  await expect(route).toBeVisible();
  const height = await route.evaluate((node) => node.parentElement?.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(0);
  await page.goto(
    `/iframe.html?id=components-journal-filter-toolbar--default&viewMode=story&globals=theme:${theme}`,
  );
  const journal = page.getByRole("searchbox", { name: "Search journal" });
  await expect(journal).toBeVisible();
  expect(await journal.evaluate((node) => node.parentElement?.getBoundingClientRect().height)).toBe(
    height,
  );
});
