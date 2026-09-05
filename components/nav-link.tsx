"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { AppLink } from "@/components/ui/app-link";

type NavLinkProps = Omit<ComponentProps<typeof AppLink>, "href"> & {
  href: string;
  hideWithin?: boolean;
};

/** AppLink that marks itself `aria-current="page"` when its href matches
 * the current pathname exactly. Lets the (server-rendered) header nav and the
 * mobile drawer expose the active link without turning either into a bespoke
 * client component. */
export function NavLink({ href, hideWithin = false, ...props }: NavLinkProps) {
  const pathname = usePathname();
  if (hideWithin && (pathname === href || pathname.startsWith(`${href}/`))) return null;
  return <AppLink href={href} aria-current={pathname === href ? "page" : undefined} {...props} />;
}
