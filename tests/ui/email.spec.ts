import { expect, test } from "@playwright/test";

import { auditEmailPreview } from "./email-accessibility";

test("email accessibility checks cover the document inside the sandbox", async ({ page }) => {
  await page.goto("/iframe.html?id=patterns-email--contact&viewMode=story");
  const results = await auditEmailPreview(page);
  expect(results.violations).toEqual([]);
  expect(results.passes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "document-title" }),
      expect.objectContaining({ id: "html-has-lang" }),
      expect.objectContaining({ id: "color-contrast" }),
      expect.objectContaining({ id: "image-alt" }),
      expect.objectContaining({ id: "link-name" }),
    ]),
  );
  await expect(page.locator('iframe[title="Email preview"]')).toHaveAttribute(
    "sandbox",
    "allow-same-origin",
  );
});

test("email documents load the full logo PNG, fit the viewport, and keep literal visitor content", async ({
  page,
}, testInfo) => {
  const theme = testInfo.project.use.colorScheme === "dark" ? "dark" : "light";
  for (const variant of [
    "verification",
    "password-reset",
    "welcome",
    "friend-request",
    "contact",
    "moderation-decision",
  ]) {
    await page.goto(
      `/iframe.html?id=patterns-email--${variant}&viewMode=story&globals=theme:${theme}`,
    );
    const email = page.frameLocator('iframe[title="Email preview"]');
    const logo = email.getByRole("img", { name: "Betabook — Climb · Log · Progress", exact: true });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute(
      "src",
      "http://127.0.0.1:6007/branding/betabook-lockup-email.png",
    );
    await expect
      .poll(() =>
        logo.evaluate(
          (node: HTMLImageElement) =>
            node.complete && node.naturalWidth === 1000 && node.naturalHeight === 640,
        ),
      )
      .toBe(true);
    const logoSize = await logo.boundingBox();
    expect(logoSize).not.toBeNull();
    expect(logoSize?.width).toBeLessThanOrEqual(350);
    expect((logoSize?.width ?? 0) / (logoSize?.height ?? 1)).toBeCloseTo(1000 / 640, 2);
    const dimensions = await email.locator("html").evaluate((node) => ({
      content: node.scrollWidth,
      viewport: node.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await expect(email.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(email.locator("img")).toHaveCount(1);
    await expect(email.locator("script")).toHaveCount(0);
    if (variant === "contact") {
      await expect(email.locator("body")).toContainText(
        '<img src=x onerror="alert(1)"> & <script>alert(1)</script>',
      );
      await expect(email.locator("body")).toContainText("The new trail starts near the bridge.");
    }
    if (variant === "welcome") {
      await expect(email.locator("body")).not.toContainText("https://");
      await expect(
        email.getByRole("link", { name: "Import your logbook", exact: true }),
      ).toHaveAttribute("href", "https://example.test/account/import");
      await expect(
        email.getByRole("link", { name: "Log your first send", exact: true }),
      ).toHaveAttribute("href", "https://example.test");
      await expect(email.getByRole("link", { name: "Get in touch", exact: true })).toHaveAttribute(
        "href",
        "https://example.test/contact",
      );
    }
    if (variant === "verification") {
      const action = email.getByRole("link", { name: "Verify email", exact: true });
      await expect(action).toHaveAttribute(
        "href",
        `https://example.test/api/auth/verify-email?token=${"sample-token-".repeat(20)}&callbackURL=%2Fsign-in`,
      );
      await action.focus();
      await expect(action).toBeFocused();
      await action.press("Enter");
      await expect(action).toBeVisible();
    }
    await testInfo.attach(`email-${variant}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }
});

test("email actions and copy remain available when images are blocked", async ({ page }) => {
  await page.route("**/branding/betabook-lockup-email.png", (route) => route.abort());
  await page.goto("/iframe.html?id=patterns-email--friend-request&viewMode=story");
  const email = page.frameLocator('iframe[title="Email preview"]');
  await expect(email.getByRole("heading", { name: "New friend request" })).toBeVisible();
  await expect(email.locator("body")).toContainText(
    "Casey & Morgan sent you a friend request on Betabook.",
  );
  await expect(
    email.getByRole("link", { name: "View friend requests", exact: true }),
  ).toHaveAttribute("href", "https://example.test/friends?view=requests");
});
