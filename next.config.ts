import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` serves /_next dev resources only to the host it started with,
  // 403ing everything else — which breaks opening it from a phone on the LAN.
  // No effect on a production build.
  //
  // Exact hosts, never wildcards: Next matches `*` against any hostname
  // label, not an IPv4 octet, so `192.168.*.*` would also admit
  // `192.168.attacker.com`. Add yours via DEV_ORIGINS (comma-separated).
  allowedDevOrigins: [
    "192.168.50.242",
    // oxlint-disable-next-line node/no-process-env
    ...(process.env.DEV_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []),
  ],
  env: {
    // Inlined at build time — the footer's copyright year must not come from
    // a runtime `new Date()` in the root layout, which would block making the
    // shell fully prerenderable (cacheComponents) later.
    NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()),
  },
};

void initOpenNextCloudflareForDev();

export default nextConfig;
