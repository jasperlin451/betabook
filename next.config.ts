import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // `next dev` serves /_next dev resources (HMR, chunks) only to the host it
  // was started with, 403ing everything else — which breaks opening the dev
  // server from another device on the LAN. Private-range hosts only; this has
  // no effect on a production build.
  allowedDevOrigins: ["192.168.50.242", "192.168.*.*", "10.*.*.*"],
  env: {
    // Inlined at build time — the footer's copyright year must not come from
    // a runtime `new Date()` in the root layout, which would block making the
    // shell fully prerenderable (cacheComponents) later.
    NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()),
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
