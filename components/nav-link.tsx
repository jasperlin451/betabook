"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@heroui/react";

type NavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** HeroUI Link that marks itself `aria-current="page"` when its href matches
 * the current pathname exactly. Lets the (server-rendered) header nav and the
 * mobile drawer expose the active link without turning either into a bespoke
 * client component. */
export function NavLink({ href, ...props }: NavLinkProps) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      {...props}
    />
  );
}
