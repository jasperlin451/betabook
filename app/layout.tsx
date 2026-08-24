import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Link } from "@heroui/react";
import { Mountain } from "lucide-react";
import { Providers } from "./providers";
import { AuthNav } from "@/components/auth-nav";
import "./globals.css";

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
          <header className="border-b border-separator px-4 py-3">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold text-foreground no-underline"
              >
                <Mountain className="size-5" />
                Senderoni
              </Link>
              <nav className="flex flex-wrap items-center gap-6 text-sm">
                <Link href="/">Search</Link>
                <AuthNav />
              </nav>
            </div>
          </header>
          <main className="flex-1 p-4">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <footer className="border-t border-separator px-4 py-4 text-sm text-muted">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <span>&copy; {new Date().getFullYear()} Senderoni</span>
              <nav className="flex items-center gap-6">
                <Link href="/">Search</Link>
                <AuthNav />
              </nav>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
