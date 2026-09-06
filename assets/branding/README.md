# Betabook logo reference

The logo depicts a mountain continuing into a checkmark, with a coral sun above.
The full lockup includes the lowercase **betabook** wordmark and the tagline
**CLIMB · LOG · PROGRESS**. Preserve their proportions and spacing.

- `betabook-lockup-light.svg`: transparent artwork with ink lettering for paper surfaces.
- `betabook-lockup-dark.svg`: transparent artwork with paper lettering for ink surfaces.
- Matching `.png` files: transparent 1000 × 640 reference renders used by Storybook.
- `betabook-icon-light.svg` and `betabook-icon-dark.svg`: square, transparent,
  icon-only treatments for compact placements, with ink/paper artwork respectively.
  These share the lockup's mountain, tapered checkmark, and coral sun, with no fonts
  or lettering. Matching PNGs are 512 × 512. Use at 48px and larger.
- `betabook-icon-small-light.svg` and `betabook-icon-small-dark.svg`: optical
  variants for 16–32px, with a taller silhouette, stronger strokes, larger sun,
  and a check tip that survives small-size rasterization. Matching PNGs are
  64 × 64 for high-density rendering. These are intentionally redrawn; do not
  scale their heavier strokes up for the full logo. Storybook shows actual-size
  browser tabs, compact headers, and an app tile on paper/ink surfaces.

The wordmark uses **Barlow Condensed Bold (700)**, matching the application's
wordmark/display family. The tagline uses **Geist Medium (500)**, matching the
system's supporting text family. Both lockup SVGs embed the bundled WOFF2 font files,
so their editable text renders without depending on installed system fonts.
The checkmark's rising stroke tapers from the mountain's substantial join to a
fine tip in the standard mark. The optical small-size cut retains a taper but
gives its endpoint enough weight to survive rasterization. Do not use the full
wordmark/tagline at favicon size.

Regenerate both SVG and transparent PNG treatments with:

```sh
pnpm brand:generate
```

The [generator](../../scripts/generate-brand-assets.ts) reads the existing font
files and ink/paper palette values from `app/globals.css`, then renders the PNGs
with Playwright Chromium. Run `pnpm exec playwright install chromium` once if
needed. Edit the generator, rather than independently editing its outputs.

Artwork uses coral `#ef846c` for the sun, and the application's ink `#000000`
and paper `#eaf7ef` for lettering. Keep the lettering aligned with the palette
when regenerating these reference images. Do not bake a background into the
artwork: the reference panels use `bg-background` under their explicit light
or dark theme, so their backgrounds always come from `app/globals.css`.

This reference is the approved visual composition from the branding discussion.
Production header, favicon, manifest, and social preview integration remain part
of the broader branding migration.
