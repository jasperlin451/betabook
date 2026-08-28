import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Link } from "@heroui/react";
import { Mountain } from "lucide-react";
import Script from "next/script";
import { Providers } from "./providers";
import { AuthNav } from "@/components/auth-nav";
import { MobileNav } from "@/components/mobile-nav";
import { PAGE_MAX_WIDTH_CLASS } from "@/components/ui/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betabook",
  description: "Climbing crag and route database",
};

// Runs before the browser paints, so the saved/system theme is applied to
// <html> before any CSS renders — otherwise the page paints with the
// un-attributed (light) styles first and flashes to the real theme once
// @heroui/react's useTheme() hydrates and applies it. Mirrors that hook's own
// storage key and resolution logic exactly (see use-theme.js).
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
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SET_THEME_SCRIPT }}
        />
        <Providers>
          <header className="border-b border-separator px-4 py-3">
            <div className={`mx-auto flex w-full ${PAGE_MAX_WIDTH_CLASS} flex-wrap items-center justify-between gap-2`}>
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold text-foreground no-underline"
              >
                <Mountain className="size-5" />
                Betabook
              </Link>
              <nav className="hidden items-center gap-6 text-sm md:flex">
                <Link href="/">Search</Link>
                <AuthNav />
              </nav>
              <MobileNav />
            </div>
          </header>
          <main className="flex-1 p-4">
            <div className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS}`}>{children}</div>
          </main>
          <footer className="border-t border-separator px-4 py-4 text-sm text-muted">
            <div className={`mx-auto flex w-full ${PAGE_MAX_WIDTH_CLASS} items-center justify-between`}>
              <span>&copy; {new Date().getFullYear()} Betabook</span>
              <nav className="hidden items-center gap-6 md:flex">
                <Link href="/">Search</Link>
                <AuthNav />
              </nav>
              <MobileNav />
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
