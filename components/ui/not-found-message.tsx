import type { ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";
import { PageTitle } from "@/components/ui/typography";

type NotFoundMessageProps = {
  heading: string;
  message: ReactNode;
  /** Where the escape-hatch link points. */
  linkHref?: string;
  linkText?: string;
};

export function NotFoundMessage({
  heading,
  message,
  linkHref = "/",
  linkText = "Search from the home page",
}: NotFoundMessageProps) {
  return (
    <div className="flex flex-col gap-2">
      <PageTitle className="text-2xl">{heading}</PageTitle>
      <p className="text-muted">{message}</p>
      <AppLink href={linkHref} className="self-start">
        {linkText}
      </AppLink>
    </div>
  );
}
