import { expect, test } from "@playwright/test";

test("production branding loads and fits navigation and About", async ({ page }, testInfo) => {
  await page.goto("/about");
  const home = page.getByRole("link", { name: "Betabook home", exact: true });
  await expect(home).toBeVisible();
  const lockup = page.getByRole("img", { name: "Betabook — Climb · Log · Progress", exact: true });
  await expect(lockup).toBeVisible();
  const wordmark = home.locator('[data-brand="wordmark"]');
  if (testInfo.project.name.startsWith("mobile")) await expect(wordmark).toBeHidden();
  else await expect(wordmark).toBeVisible();
  await expect(home).toHaveCSS("height", "48px");
  const visibleImages = page.locator("[data-brand] img:visible");
  await expect(visibleImages).toHaveCount(testInfo.project.name.startsWith("mobile") ? 2 : 3);
  for (const image of await visibleImages.all()) {
    await expect
      .poll(() =>
        image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    await expect(image).toHaveAttribute(
      "src",
      new RegExp(`-${testInfo.project.use.colorScheme}\\.svg$`),
    );
  }
  const box = await lockup.boundingBox();
  if (!box) throw new Error("Missing logo bounds");
  expect(box.width).toBeLessThanOrEqual(360);
  expect(box.width / box.height).toBeCloseTo(500 / 320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await testInfo.attach("about-branding", {
    body: await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("about-branding.png"),
    }),
    contentType: "image/png",
  });
  // Explicit app choices override the OS scheme and survive a reload.
  await page.getByRole("button", { name: "Theme: system. Switch to light." }).click();
  await expect(lockup.locator("img:visible")).toHaveAttribute("src", /-light\.svg$/);
  await page.getByRole("button", { name: "Theme: light. Switch to dark." }).click();
  await expect(lockup.locator("img:visible")).toHaveAttribute("src", /-dark\.svg$/);
  await page.reload();
  await expect(lockup.locator("img:visible")).toHaveAttribute("src", /-dark\.svg$/);
  await home.click();
  await expect(page).toHaveURL("/");
});

test("tab, touch, install and social metadata point to decodable approved assets", async ({
  page,
  request,
}) => {
  await page.goto("/about");
  const icons = page.locator('link[rel="icon"]');
  await expect(icons).toHaveCount(2);
  const iconUrls = await icons.evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href),
  );
  expect(iconUrls.some((url) => new URL(url).pathname === "/favicon.ico")).toBe(true);
  expect(iconUrls.some((url) => new URL(url).pathname === "/icon.svg")).toBe(true);
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(touch).toContain("/apple-icon.png");
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href");
  if (!manifestUrl || !touch) throw new Error("Missing install metadata");
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.icons).toHaveLength(2);
  const social = await page.locator('meta[property="og:image"]').getAttribute("content");
  const twitter = await page.locator('meta[name="twitter:image"]').getAttribute("content");
  if (!social || !twitter) throw new Error("Missing social metadata");
  expect(new URL(social).pathname).toBe("/opengraph-image.png");
  expect(new URL(twitter).pathname).toBe("/opengraph-image.png");
  const assets = [
    ...iconUrls.map((url) => ({ url, size: 32 })),
    { url: touch, size: 180 },
    ...manifest.icons.map((icon: { src: string; sizes: string }) => ({
      url: icon.src,
      size: Number(icon.sizes.split("x")[0]),
    })),
    { url: new URL(social).pathname, size: 1200 },
  ];
  for (const { url, size } of assets) {
    const asset = await request.get(url);
    expect(asset.ok(), url).toBe(true);
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, url);
    expect(dimensions.width, url).toBe(size);
    expect(dimensions.height, url).toBe(size === 1200 ? 630 : size);
  }
});
