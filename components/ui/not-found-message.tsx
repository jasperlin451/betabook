import { PageTitle } from "@/components/ui/typography";
import type { ReactNode } from "react";
import { Link } from "@heroui/react";

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
      <Link href={linkHref} className="self-start">
        {linkText}
      </Link>
    </div>
  );
}
