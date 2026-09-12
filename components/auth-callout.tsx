"use client";

import { buttonVariants } from "@heroui/react";

import { AppLink } from "@/components/ui/app-link";
import { cardClass } from "@/components/ui/card";
import { signInUrl, signUpUrl } from "@/lib/sign-in-redirect";

export function AuthCallout({
  next,
  onNavigate,
  description = "Individual ascents, climber profiles, and your own logbook are available to signed-in Betabook members.",
}: {
  next: string;
  onNavigate?: () => void;
  description?: string;
}) {
  return (
    <section aria-label="Member content" className={cardClass("md")}>
      <div className="flex flex-col gap-3">
        <p className="font-semibold">Sign in or sign up to see all the content.</p>
        <p className="text-sm text-muted">{description}</p>
        <div className="flex flex-wrap gap-3">
          <AppLink href={signInUrl(next)} onClick={onNavigate} className={buttonVariants()}>
            Sign in
          </AppLink>
          <AppLink
            href={signUpUrl(next)}
            onClick={onNavigate}
            className={buttonVariants({ variant: "outline" })}
          >
            Sign up
          </AppLink>
        </div>
      </div>
    </section>
  );
}
