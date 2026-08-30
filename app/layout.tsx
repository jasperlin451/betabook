import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { Mountain } from "lucide-react";
import { Providers } from "./providers";
import { AuthNav } from "@/components/auth-nav";
import { MobileNav } from "@/components/mobile-nav";
import { NavLink } from "@/components/nav-link";
import { ThemeSwitch } from "@/components/theme-toggle";
import { AppLink } from "@/components/ui/app-link";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import "./globals.css";

// The guidebook display voice — see --font-display in globals.css. Vendored
// woff2 (latin subset, the two weights the display roles use) rather than
// next/font/google: the Google loader downloads at build time and aborts the
// build in a sandboxed/offline environment — the same condition that moved
// Geist to package assets.
const barlowCondensed = localFont({
  src: [
    { path: "../assets/fonts/barlow-condensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "../assets/fonts/barlow-condensed-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
  // Condensed faces shift layout hard on fallback; metric-adjusted Arial
  // keeps the swap from reflowing the wordmark and titles.
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: {
    default: "Betabook",
    template: "%s · Betabook",
  },
  description: "Climbing crag and route database",
};

export const viewport: Viewport = {
  // Matches --background per theme (globals.css: paper in light, ink in
  // dark), so the browser chrome follows the app instead of staying light
  // on the dark theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Rendered as a PLAIN inline <script> at the top of <body> — deliberately
// not next/script: in the App Router, `beforeInteractive` is queued into
// self.__next_s and only executed right before hydration, i.e. after the
// bundle downloads — far too late to stop a light-themed first paint. A
// plain parser-executed script runs before any following content paints.
// Mirrors @heroui/react useTheme()'s storage key and resolution exactly
// (see use-theme.js). Also pins the browser-chrome theme-color for an
// explicit theme choice — the static media-query metas only track the OS
// preference (keep the colors and logic in sync with lib/theme-color.ts).
const SET_THEME_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("heroui-theme") || "system";
    var resolved =
      theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
    document.documentElement.classList.add(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    if (theme !== "system") {
      var m = document.createElement("meta");
      m.name = "theme-color";
      m.content = resolved === "dark" ? "#000000" : "#eaf7ef";
      m.setAttribute("data-explicit-theme", "");
      document.head.appendChild(m);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${barlowCondensed.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: SET_THEME_SCRIPT }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
        >
          Skip to content
        </a>
        <Providers>
          <header className="border-b border-separator px-4 py-3">
            <div className={`mx-auto flex w-full ${PAGE_MAX_WIDTH_CLASS} flex-wrap items-center justify-between gap-2`}>
              <AppLink
                href="/"
                className="flex items-center gap-2 font-display text-xl font-bold tracking-wide text-foreground uppercase no-underline"
              >
                <Mountain className="size-5" />
                Betabook
              </AppLink>
              <div className="flex items-center gap-3">
                <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
                  <NavLink href="/">Search</NavLink>
                  <AuthNav />
                </nav>
                <ThemeSwitch />
                <MobileNav />
              </div>
            </div>
          </header>
          {/* tabIndex lets the skip link move focus here, not just scroll. */}
          <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none">
            <div className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>{children}</div>
          </main>
          <footer className="border-t border-separator px-4 py-4 text-sm text-muted">
            <div className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>
              <span>&copy; {process.env.NEXT_PUBLIC_BUILD_YEAR} Betabook</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
