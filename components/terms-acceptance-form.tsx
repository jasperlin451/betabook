"use client";

import { Button, Checkbox } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptTerms } from "@/actions/terms";
import { SignOutButton } from "@/components/sign-out-button";
import { AppLink } from "@/components/ui/app-link";
import { FORM_CARD_CLASS } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/typography";
import type { ActionResult } from "@/lib/action-result";
import { termsHref } from "@/lib/terms";
import { termsNextPath } from "@/lib/terms-navigation";

export function TermsAcceptanceForm({
  version,
  versionLabel,
  previousVersion,
  next,
  onAccept = acceptTerms,
  onSignOut,
}: {
  version: string;
  versionLabel: string;
  previousVersion: string | null;
  next?: string;
  onAccept?: (version: unknown, agreed: unknown) => Promise<ActionResult>;
  onSignOut?: () => void;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!agreed || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onAccept(version, agreed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(termsNextPath(next));
      router.refresh();
    } catch {
      setError("Could not save your agreement. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={submit} className={FORM_CARD_CLASS}>
        <PageTitle>Review the Terms of Service</PageTitle>
        <p className="text-sm text-muted">
          {previousVersion
            ? "The terms have been updated since your last agreement."
            : "Please review and accept the terms before continuing to your account."}
        </p>
        <AppLink
          href={termsHref(version)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Read the Terms of Service
        </AppLink>
        <p className="text-sm text-muted">Version dated {versionLabel}</p>
        <Checkbox isSelected={agreed} onChange={setAgreed} isDisabled={pending} isRequired>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            I agree to these Terms of Service
          </Checkbox.Content>
        </Checkbox>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth isDisabled={!agreed || pending}>
          {pending ? "Saving agreement…" : "Accept and continue"}
        </Button>
      </form>
      <SignOutButton onSignOut={onSignOut} />
      <p className="text-sm text-muted">
        Questions?{" "}
        <AppLink href="/contact" className="inline underline">
          Contact us
        </AppLink>
        .
      </p>
    </div>
  );
}
