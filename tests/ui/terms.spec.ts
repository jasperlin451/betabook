import { appBaseURL } from "./app-server";
import { expect, test } from "./story";

test.use({ baseURL: appBaseURL });

test("terms open from signup without losing entries and remain reachable from the footer", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/sign-up?next=%2Faccount");
  const email = page.getByRole("textbox", { name: "Email" });
  await email.fill("climber@example.com");
  const popup = context.waitForEvent("page");
  await page.getByRole("link", { name: /Read the Terms of Service/ }).click();
  const terms = await popup;
  await expect(terms).toHaveURL(`${appBaseURL}/terms`);
  await expect(terms.getByRole("heading", { name: "Terms of Service", exact: true })).toBeVisible();
  await expect(terms.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://betabook.ca/terms",
  );
  await expect(email).toHaveValue("climber@example.com");
  await expect(
    page.getByRole("checkbox", { name: /I agree to the Terms of Service/ }),
  ).not.toBeChecked();
  await terms.close();
  await testInfo.attach("signup-agreement", {
    body: await page.screenshot({
      fullPage: true,
      animations: "disabled",
      path: testInfo.outputPath("signup-agreement.png"),
    }),
    contentType: "image/png",
  });
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms of Service" }).click();
  await expect(page).toHaveURL("/terms");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await testInfo.attach("terms-page", {
    body: await page.screenshot({
      fullPage: true,
      animations: "disabled",
      path: testInfo.outputPath("terms-page.png"),
    }),
    contentType: "image/png",
  });
  await page.getByRole("article").getByRole("link", { name: "contact form" }).last().click();
  await expect(page).toHaveURL("/contact");
});
