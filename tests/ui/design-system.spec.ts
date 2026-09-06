import { readFileSync } from "node:fs";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

async function openStory(page: Page, testInfo: TestInfo, story: string) {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  await page.goto(
    `/iframe.html?id=${story.includes("--") ? story : `foundations-brand-and-style--${story}`}&viewMode=story&globals=theme:${theme}`,
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

// The build is the authoritative story index. New stories inherit the same
// accessibility, viewport and screenshot checks without a separate test list.
const index = JSON.parse(readFileSync("storybook-static/index.json", "utf8")) as {
  entries: Record<string, { id: string; type: string }>;
};
const stories = Object.values(index.entries)
  .filter((entry) => entry.type === "story")
  .map((entry) => entry.id);
if (stories.length === 0) throw new Error("Storybook built no stories");
for (const story of stories) {
  test(`${story} stays accessible and fits the viewport`, async ({ page }, testInfo) => {
    await openStory(page, testInfo, story);
    const results = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await testInfo.attach(story, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
}

test("complete brand lockups load in both color treatments", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "foundations");
  const logos = page.getByRole("img", {
    name: "Betabook — Climb · Log · Progress. A mountain turning into a checkmark, with a sun.",
  });
  await expect(logos).toHaveCount(2);
  for (const logo of await logos.all()) {
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    // The artwork must let the theme's paper/ink surface show through.
    const cornerAlpha = await logo.evaluate((element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error("Expected logo image");
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(element, 0, 0);
      return context.getImageData(0, 0, 1, 1).data[3];
    });
    expect(cornerAlpha).toBe(0);
  }
  for (const [theme, token] of [
    ["light", "--palette-paper"],
    ["dark", "--palette-ink"],
  ]) {
    const panel = page.getByTestId(`logo-${theme}`);
    const expectedColor = await panel.evaluate((element, paletteToken) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${paletteToken})`;
      element.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    }, token);
    await expect(panel).toHaveCSS("background-color", expectedColor);
  }
});

test("shared panel geometry and typography stay consistent", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "foundations");
  const small = page.getByTestId("card-small");
  const medium = page.getByTestId("card-medium");
  await expect(small).toHaveCSS("border-radius", "12px");
  await expect(medium).toHaveCSS("border-radius", "12px");
  await expect(small).toHaveCSS("padding", "16px");
  await expect(medium).toHaveCSS("padding", "24px");
  await expect(small).toHaveCSS("box-shadow", "none");
  const rows = page.getByTestId("climb-rows").locator(":scope > div");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveCSS("border-radius", "0px");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /barlow/i);
  await expect(page.getByText("V4", { exact: true }).first()).toHaveCSS("font-family", /geist/i);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "30px");
});

for (const panel of [
  {
    name: "feed card",
    story: "components-journal-feed-day-card--activity-feed",
    selector: "article",
  },
  {
    name: "empty state",
    story: "components-feedback-empty-state--no-results",
    selector: "div.border-dashed",
  },
  {
    name: "mobile helper",
    story: "components-feedback-mobile-app-helper--instructions",
    selector: "aside",
  },
  {
    name: "loading card",
    story: "components-feedback-skeleton--stat-card",
    selector: ".bg-surface-secondary",
  },
]) {
  test(`${panel.name} follows the shared panel radius`, async ({ page }, testInfo) => {
    await openStory(page, testInfo, panel.story);
    const surface = page.locator(panel.selector);
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveCSS("border-radius", "12px");
    // A theme-token change must reach real feature surfaces, not just the
    // card helper example. This catches a local hard-coded radius override.
    await page.evaluate(() => document.documentElement.style.setProperty("--radius-panel", "20px"));
    await expect(surface).toHaveCSS("border-radius", "20px");
  });
}

test("native selects match HeroUI fields and keyboard focus is visible", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "patterns-forms--forms");
  const input = page.getByRole("textbox", { name: "Climb name" });
  const select = page.getByLabel("Discipline", { exact: true });
  const fieldRadius = await input.evaluate((element) => getComputedStyle(element).borderRadius);
  await expect(select).toHaveCSS("border-radius", fieldRadius);
  await expect(input).toHaveValue("Cedar Arete");
  await input.focus();
  await page.keyboard.press("Tab");
  await expect(select).toBeFocused();
  // HeroUI paints field focus with a two-pixel ring (box shadow), not an outline.
  await expect(select).toHaveCSS("box-shadow", /0px 0px 0px 2px/);
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("textbox", { name: "Unavailable field" })).toBeDisabled();
});

test("delete dialog supports keyboard cancellation and explicit confirmation", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "components-feedback-confirm-delete-dialog--delete-confirmation");
  const trigger = page.getByRole("button", { name: "Delete sample send" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Delete this send?");
  const results = await new AxeBuilder({ page })
    .include('[role="alertdialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  // Alert dialogs intentionally require an explicit choice; HeroUI disables
  // Escape dismissal by default. Cancel must remain keyboard-accessible.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Sample send is saved.");
  await trigger.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Sample send deleted.");
  await expect(trigger).toBeDisabled();
});

test("palette documentation follows live CSS token changes", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "foundations-tokens--palette");
  const paper = page.locator('[data-token="--palette-paper"]');
  await expect(paper.locator("output")).not.toBeEmpty();
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--palette-paper", "rgb(240, 230, 210)"),
  );
  await expect(paper.locator('[aria-hidden="true"]')).toHaveCSS(
    "background-color",
    "rgb(240, 230, 210)",
  );
  await expect(paper.locator("output")).toHaveText("rgb(240, 230, 210)");
});

test("search suggestions support keyboard selection and empty results", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "components-inputs-search-combobox--search");
  const input = page.getByRole("combobox", { name: "Find a climb" });
  await input.fill("cedar");
  await expect(page.getByRole("option", { name: "Cedar Arete", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  // Leaving the input dismisses the suggestion overlay, which intentionally
  // hides surrounding content from the accessibility tree while open.
  await input.press("Tab");
  await expect(page.getByRole("status")).toHaveText("Selected: Cedar Arete");
  await input.fill("zzz");
  await expect(page.getByText("No matching climbs.")).toBeVisible();
});

test("actions menu keeps actions local and returns focus", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "components-navigation-actions-menu--actions");
  const trigger = page.getByRole("button", { name: "Sample climb actions" });
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include('[role="menu"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.getByRole("menuitem", { name: "Edit climb" }).click();
  await expect(page.getByRole("status")).toHaveText("Action: edit");
  await expect(trigger).toBeFocused();
});

test("long comments expand and collapse", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "patterns-climbing-data--rows-and-comments");
  const expand = page.getByRole("button", { name: "Show more" });
  await expand.click();
  await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(expand).toHaveAttribute("aria-expanded", "false");
});

test("journal tags add, reject invalid input, and remove", async ({ page }, testInfo) => {
  await openStory(page, testInfo, "components-journal-tag-input--journal-tags");
  const input = page.getByRole("textbox", { name: "Add a tag" });
  await input.fill("hangboard");
  await input.press("Enter");
  const tag = page.getByRole("button", { name: "Remove tag hangboard" });
  await expect(tag).toBeVisible();
  await input.fill("bad!");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Remove tag bad!" })).toHaveCount(0);
  await input.fill("");
  await tag.click();
  await expect(tag).toHaveCount(0);
});

test("coverage links open the selected story in the Storybook manager", async ({
  page,
}, testInfo) => {
  await openStory(page, testInfo, "internal-coverage--inventory");
  await page
    .locator("li")
    .filter({ hasText: "ui/actions-menu.tsx" })
    .getByRole("link", { name: "View example" })
    .click();
  await expect(page).toHaveURL(/\/\?path=\/story\/components-navigation-actions-menu--actions$/);
  await expect(
    page.frameLocator("#storybook-preview-iframe").getByRole("heading", { name: "Actions menu" }),
  ).toBeVisible();
});

test("MCP component manifest includes usable component documentation", async ({ request }) => {
  const response = await request.get("/manifests/components.json");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    components: Record<string, { name: string; error?: unknown; stories: unknown[] }>;
  };
  const components = Object.values(manifest.components);
  expect(components.map((component) => component.name)).toEqual(
    expect.arrayContaining([
      "SearchCombobox",
      "ListRow",
      "PrivacyFields",
      "ColorPage",
      "CoveragePage",
    ]),
  );
  for (const component of components) {
    expect(component.error, component.name).toBeUndefined();
    expect(component.stories.length, component.name).toBeGreaterThan(0);
  }
});
