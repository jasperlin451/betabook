import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

async function main() {
  // Embed the exact system fonts so standalone SVGs and their PNG previews
  // render identically, without relying on fonts installed on the viewer's OS.
  const root = new URL("../", import.meta.url);
  const displayFont = await readFile(
    new URL("assets/fonts/barlow-condensed-700-latin.woff2", root),
    "base64",
  );
  const bodyFont = await readFile(
    new URL("node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2", root),
    "base64",
  );
  const theme = await readFile(new URL("app/globals.css", root), "utf8");
  function palette(name: string) {
    const match = theme.match(new RegExp(`--palette-${name}:\\s*([^;]+);`));
    if (!match) throw new Error(`Missing palette color: ${name}`);
    return match[1].trim();
  }

  // The mountain keeps its broad base. The check's rising edges converge
  // from a substantial join at (282, 131) to a narrow, almost pointed tip.
  const mountain =
    "M129 151 L202 78 Q205 75 208 78 L237 108 L249 97 Q252 94 255 97 L282 124 L359 62 Q361 60.5 360 63 L285 138 Q282 141 279 138 L252 111 L240 122 Q237 125 234 122 L205 92 L147 151 Z";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    for (const [treatment, color] of [
      ["light", palette("ink")],
      ["dark", palette("paper")],
    ]) {
      const mark = `<path d="${mountain}" fill="${color}"/>
<circle cx="312" cy="60" r="14" fill="#ef846c"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" role="img" aria-labelledby="title">
<title id="title">Betabook — Climb, Log, Progress. A mountain becomes a checkmark beneath the sun.</title>
<style>
@font-face { font-family: "Barlow Condensed"; src: url("data:font/woff2;base64,${displayFont}") format("woff2"); font-weight: 700; }
@font-face { font-family: "Geist"; src: url("data:font/woff2;base64,${bodyFont}") format("woff2"); font-weight: 500; }
</style>
<g fill="${color}">
${mark}
<text x="250" y="237" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="92" letter-spacing="1">betabook</text>
<text x="250" y="274" text-anchor="middle" font-family="Geist" font-size="11" font-weight="500" letter-spacing="4">CLIMB<tspan fill="#ef846c"> · </tspan>LOG<tspan fill="#ef846c"> · </tspan>PROGRESS</text>
</g>
</svg>\n`;
      const base = new URL(`assets/branding/betabook-lockup-${treatment}`, root);
      await writeFile(`${fileURLToPath(base)}.svg`, svg);
      await page.setViewportSize({ width: 1000, height: 640 });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:1000px;height:640px}</style>${svg}`,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${fileURLToPath(base)}.png`, omitBackground: true });

      // Square canvas centers the original mark with breathing room at the edges.
      // Share its geometry with the lockup so the icon cannot drift independently.
      const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="113 -34 264 264" role="img" aria-labelledby="title">
<title id="title">Betabook: a mountain turning into a checkmark, with a sun.</title>
${mark}
</svg>\n`;
      const iconBase = fileURLToPath(new URL(`assets/branding/betabook-icon-${treatment}`, root));
      await writeFile(`${iconBase}.svg`, icon);
      await page.setViewportSize({ width: 512, height: 512 });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:512px;height:512px}</style>${icon}`,
      );
      await page.screenshot({ path: `${iconBase}.png`, omitBackground: true });

      // Optical cut for 16–32px: taller silhouette, wider mountain strokes,
      // a larger sun, and a finite check tip instead of a subpixel hairline.
      // This is deliberately redrawn, not a distorted scale of the full logo.
      const smallIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-labelledby="title">
<title id="title">Betabook: a mountain turning into a checkmark, with a sun.</title>
<path fill="${color}" d="M2 25 L10 13 Q11 11 12 13 L16 17 L18 15 Q19 14 20 15 L23 19 L30 9 L31 10 L24 23 Q23 24 22 23 L19 19 L17 21 Q16 22 15 21 L11 17 L6 25 Z"/>
<circle cx="24" cy="7" r="2.5" fill="#ef846c"/>
</svg>\n`;
      const smallBase = fileURLToPath(
        new URL(`assets/branding/betabook-icon-small-${treatment}`, root),
      );
      await writeFile(`${smallBase}.svg`, smallIcon);
      await page.setViewportSize({ width: 64, height: 64 });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:64px;height:64px}</style>${smallIcon}`,
      );
      await page.screenshot({ path: `${smallBase}.png`, omitBackground: true });
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
