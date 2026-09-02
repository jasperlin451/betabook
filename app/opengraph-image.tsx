import { ImageResponse } from "next/og";

import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// One static card for every share/preview surface. No per-route variants —
// generated once at build and served at /opengraph-image. Dimensions and alt
// live on OG_IMAGE so pageMetadata() and this generator can't drift.
export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = "image/png";

// The header wordmark's lucide "mountain" glyph (node_modules/lucide-react
// icons/mountain), inlined because Satori can't load the component.
const MOUNTAIN_PATH = "m8 3 4 8 5-5 5 15H2L8 3z";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "96px",
        background: "#0b0f0d",
        color: "#eaf7ef",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <svg
          width="132"
          height="132"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3ddc84"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={MOUNTAIN_PATH} />
        </svg>
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: "-0.02em" }}>{SITE_NAME}</div>
      </div>
      <div style={{ fontSize: 40, marginTop: 32, color: "#9db8a8", maxWidth: 900 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>,
    size,
  );
}
