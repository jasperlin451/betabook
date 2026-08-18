import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Link } from "@heroui/react";
import { Mountain } from "lucide-react";
import { Providers } from "./providers";
import "./globals.css";

const navLinks = [
  { href: "/?mode=area", label: "Areas" },
  { href: "/?mode=climb", label: "Climbs" },
];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Senderoni",
  description: "Climbing crag and route database",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <header className="flex items-center justify-between border-b border-separator px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold text-foreground no-underline"
            >
              <Mountain className="size-5" />
              Senderoni
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
              <span className="text-muted" title="Not yet implemented">
                Log In
              </span>
            </nav>
          </header>
          <main className="flex-1 p-4">{children}</main>
          <footer className="flex items-center justify-between border-t border-separator px-4 py-4 text-sm text-muted">
            <span>&copy; {new Date().getFullYear()} Senderoni</span>
            <nav className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
              <span title="Not yet implemented">Log In</span>
            </nav>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
