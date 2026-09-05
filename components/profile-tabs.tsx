"use client";

import { clsx } from "clsx";
import { usePathname } from "next/navigation";

import { AppLink } from "@/components/ui/app-link";

type ProfileTabsProps = {
  userId: string;
  showJournal: boolean;
  showProjects: boolean;
};

export function ProfileTabs({ userId, showJournal, showProjects }: ProfileTabsProps) {
  const pathname = usePathname();
  const base = `/users/${userId}`;

  const tabs = [
    ...(showJournal ? [{ href: `${base}/journal`, label: "Journal", roots: [base] }] : []),
    { href: `${base}/sends`, label: "Sends", roots: showJournal ? [] : [base] },
    ...(showProjects ? [{ href: `${base}/projects`, label: "Projects", roots: [] }] : []),
    { href: `${base}/analytics`, label: "Analytics", roots: [] },
  ];

  return (
    <nav
      aria-label="Profile sections"
      className="w-full max-w-full overflow-x-auto border-b border-separator"
    >
      <div className="flex min-w-max items-center gap-6">
        {tabs.map((tab) => {
          const current = pathname === tab.href || tab.roots.includes(pathname);
          return (
            <AppLink
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={clsx(
                "relative py-2.5 text-sm no-underline transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
                current
                  ? "font-medium text-foreground after:bg-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </AppLink>
          );
        })}
      </div>
    </nav>
  );
}
