import { expect, test, openStory } from "./story";

test("private profile masks saved audiences and restores each independent choice", async ({
  page,
}, info) => {
  await openStory(page, info, "components-account-privacy-fields--privacy");
  const commentary = page.getByRole("button", { name: /Send commentary audience/ });
  const journal = page.getByRole("button", { name: /Journal entries audience/ });
  const profile = page.getByRole("switch", { name: "Private profile" });
  await commentary.click();
  await page.getByRole("option", { name: "Friends", exact: true }).click();
  await journal.click();
  await page.getByRole("option", { name: "Public", exact: true }).click();
  await profile.press("Space");
  await expect(profile).toBeChecked();
  for (const audience of [commentary, journal]) {
    await expect(audience).toBeDisabled();
    await expect(audience).toContainText("Only me");
  }
  await profile.press("Space");
  await expect(profile).not.toBeChecked();
  await expect(commentary).toBeEnabled();
  await expect(commentary).toContainText("Friends");
  await expect(journal).toBeEnabled();
  await expect(journal).toContainText("Public");
  await openStory(page, info, "components-account-privacy-fields--privacy-pending");
  await expect(profile).toBeDisabled();
  await expect(commentary).toBeDisabled();
  await expect(journal).toBeDisabled();
});

test("grade bounds clamp in both directions and Any stays unbounded", async ({ page }, info) => {
  await openStory(page, info, "components-inputs-index-select--range");
  const min = page.getByRole("button", { name: /Minimum grade/ });
  const max = page.getByRole("button", { name: /Maximum grade/ });
  await min.click();
  await page
    .getByRole("listbox", { name: "Minimum grade", exact: true })
    .getByRole("option", { name: "V5", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Minimum grade", exact: true })).toBeHidden();
  await expect(min).toContainText("V5");
  await expect(max).toContainText("V5");
  await max.click();
  await page
    .getByRole("listbox", { name: "Maximum grade", exact: true })
    .getByRole("option", { name: "V0", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Maximum grade", exact: true })).toBeHidden();
  await expect(min).toContainText("V0");
  await expect(max).toContainText("V0");
  await openStory(page, info, "components-inputs-index-select--unbounded-range");
  const lower = page.getByRole("button", { name: /Minimum rating/ });
  const upper = page.getByRole("button", { name: /Maximum rating/ });
  await lower.click();
  await page
    .getByRole("listbox", { name: "Minimum rating", exact: true })
    .getByRole("option", { name: "4 stars", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Minimum rating", exact: true })).toBeHidden();
  await expect(lower).toContainText("4 stars");
  await expect(upper).toContainText("Any");
  await upper.click();
  await page
    .getByRole("listbox", { name: "Maximum rating", exact: true })
    .getByRole("option", { name: "1 star", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Maximum rating", exact: true })).toBeHidden();
  await expect(lower).toContainText("1 star");
  await lower.click();
  await page
    .getByRole("listbox", { name: "Minimum rating", exact: true })
    .getByRole("option", { name: "Any", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Minimum rating", exact: true })).toBeHidden();
  await expect(upper).toContainText("1 star");
  await expect(lower).toContainText("Any");
});

test("responsive disclosure preserves typed state and the mobile expansion choice", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openStory(page, info, "components-layout-collapsible-section--responsive-section");
  const toggle = page.getByRole("button", { name: "Climb filters" });
  const input = page.getByRole("textbox", { name: "Climb name" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(input).toBeHidden();
  await toggle.press("Enter");
  await input.fill("Cedar Arete");
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Cedar Arete");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(input).toHaveValue("Cedar Arete");
  await toggle.press("Enter");
  await expect(input).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Cedar Arete");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(input).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("tag limits reject duplicates and free a place after removal", async ({ page }, info) => {
  await openStory(page, info, "components-journal-tag-input--journal-tags-full");
  const tags = page.getByRole("button", { name: /^Remove tag / });
  await expect(tags).toHaveCount(8);
  await expect(page.getByRole("textbox", { name: "Add a tag" })).toBeDisabled();
  await page.getByRole("button", { name: "Remove tag tag-1", exact: true }).press("Enter");
  const input = page.getByRole("textbox", { name: "Add a tag" });
  await input.fill("tag-2");
  await input.press("Enter");
  await expect(tags).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Remove tag tag-2", exact: true })).toHaveCount(1);
  await input.fill("new-tag");
  await input.press("Enter");
  await expect(tags).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Remove tag new-tag" })).toBeVisible();
  await expect(input).toBeDisabled();
});

test("wizard permits completed steps and keeps future steps unavailable", async ({
  page,
}, info) => {
  await openStory(page, info, "components-import-wizard-steps--import-steps");
  await expect(page.getByRole("status")).toHaveText("Current step: match");
  await page.getByRole("button", { name: "Review sample", exact: true }).click();
  await page.getByRole("button", { name: /4 Climbs/ }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Current step: match");
  await expect(page.getByRole("button", { name: /5 Review/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Complete sample", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Current step: result");
  await expect(page.getByRole("button", { name: /4 Climbs/ })).toHaveCount(0);
});

test("helper dismissal and empty-state actions have observable local outcomes", async ({
  page,
}, info) => {
  await openStory(page, info, "components-feedback-mobile-app-helper--instructions");
  const helper = page.getByRole("complementary", { name: "Add Betabook to Home Screen" });
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(helper).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Shortcut helper dismissed.");
  await page.getByRole("button", { name: "Show helper again" }).click();
  await expect(helper).toBeVisible();
  await page.getByRole("button", { name: "Dismiss shortcut helper" }).press("Enter");
  await expect(helper).toHaveCount(0);
  await openStory(page, info, "components-feedback-empty-state--with-action");
  await page.getByRole("button", { name: "Clear sample filters" }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Showing all sample sessions.");
  await expect(page.getByRole("button", { name: "Clear sample filters" })).toHaveCount(0);
});

test("calendar selection respects the latest day, clears, and keeps read-only dates unchanged", async ({
  page,
}, info) => {
  await openStory(page, info, "components-inputs-date-picker-field--dates");
  const trigger = page.getByRole("button", { name: "Calendar Empty date", exact: true });
  await trigger.press("Enter");
  const latest = page.getByRole("button", { name: /Sunday, September 6, 2026/ });
  const future = page.getByRole("button", { name: /Monday, September 7, 2026/ });
  await expect(latest).toBeEnabled();
  await expect(future).toBeDisabled();
  await info.attach("calendar-boundary", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  await latest.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("spinbutton", { name: "day, Empty date", exact: true })).toHaveText(
    "06",
  );
  await expect(page.getByRole("spinbutton", { name: "month, Empty date", exact: true })).toHaveText(
    "09",
  );
  await expect(page.getByRole("spinbutton", { name: "year, Empty date", exact: true })).toHaveText(
    "2026",
  );
  await page.getByRole("button", { name: "Clear date", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "day, Empty date", exact: true })).toHaveText(
    "dd",
  );
  const readonly = page.getByRole("spinbutton", { name: "day, Read-only date", exact: true });
  await readonly.press("ArrowUp");
  await expect(readonly).toHaveText("01");
  await expect(
    page.getByRole("button", { name: "Calendar Read-only date", exact: true }),
  ).toBeDisabled();
});

test("filter disclosure retains grade choices and reset clears the selected disciplines", async ({
  page,
}, info) => {
  await openStory(page, info, "components-inputs-filter-toolbar--filters");
  const boulder = page.getByRole("button", { name: "Boulder", exact: true });
  await boulder.press("Enter");
  await page.getByRole("button", { name: "More filters", exact: true }).press("Enter");
  const min = page.getByRole("button", { name: /Min grade/ });
  await min.click();
  await page
    .getByRole("listbox", { name: "Min grade", exact: true })
    .getByRole("option", { name: "V4", exact: true })
    .click();
  await expect(page.getByRole("listbox", { name: "Min grade", exact: true })).toBeHidden();
  await expect(min).toContainText("V4");
  await page.getByRole("button", { name: "Fewer filters", exact: true }).click();
  await expect(min).toBeHidden();
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(min).toContainText("V4");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(boulder).toHaveAttribute("aria-pressed", "false");
  await expect(min).toHaveCount(0);
  await boulder.click();
  await expect(min).toContainText("VB");
});

for (const side of ["left", "right"]) {
  test(`${side} sidebar stacks first on phones and uses its requested desktop side`, async ({
    page,
  }, info) => {
    await openStory(page, info, `components-layout-sidebar-layout--${side}`);
    const sidebar = await page
      .getByText("Sidebar content comes first on mobile.", { exact: true })
      .boundingBox();
    const content = await page.getByText("Primary content", { exact: true }).boundingBox();
    if (!sidebar || !content) throw new Error("Missing sidebar or primary content");
    if (info.project.name.startsWith("mobile")) {
      expect(sidebar.y + sidebar.height).toBeLessThan(content.y);
      expect(sidebar.width).toBeCloseTo(content.width);
    } else {
      expect(sidebar.y).toBeCloseTo(content.y);
      expect(sidebar.width).toBe(320);
      if (side === "left") expect(sidebar.x + sidebar.width).toBeLessThan(content.x);
      else expect(content.x + content.width).toBeLessThan(sidebar.x);
    }
  });
}

test("progression charts expose their summary and pan from the keyboard on phones", async ({
  page,
}, info) => {
  await openStory(page, info, "components-charts-progression-chart--progression");
  const chart = page.getByRole("region", { name: "boulder grade progression", exact: true });
  await expect(
    page.getByText("Personal best V6, from Sep 2025 (V2) to Sep 2026.", { exact: true }),
  ).toHaveCount(1);
  await chart.focus();
  await expect(chart).toBeFocused();
  await chart.press("ArrowRight");
  if (info.project.name.startsWith("mobile")) {
    await expect.poll(() => chart.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  } else {
    expect(await chart.evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(0);
  }
  const single = page.getByRole("region", { name: "sport grade progression", exact: true });
  await expect(single.locator("circle")).toHaveCount(1);
  const coordinates = await single.locator("circle").evaluate((node) => ({
    x: Number(node.getAttribute("cx")),
    y: Number(node.getAttribute("cy")),
  }));
  expect(coordinates.x).toBeGreaterThan(40);
  expect(coordinates.x).toBeLessThan(628);
  expect(coordinates.y).toBeGreaterThan(10);
  expect(coordinates.y).toBeLessThan(176);
});
