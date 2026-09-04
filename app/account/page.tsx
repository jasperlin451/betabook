import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportSendsButton } from "@/components/export-sends-button";
import { PrivateProfileToggle } from "@/components/private-profile-toggle";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeSelect } from "@/components/theme-select";
import { AppLink } from "@/components/ui/app-link";
import { FORM_CARD_CLASS } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageTitle } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getUser } from "@/db/queries";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Account",
};

/** One labeled group of related account controls — navigation, data, and
 * session actions each get their own section instead of one undifferentiated
 * stack of same-weight buttons. */
function AccountSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-separator pt-4">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    redirect(signInUrl("/account"));
  }

  const db = await getDb();
  const user = await getUser(db, session.user.id);

  return (
    <div className={FORM_CARD_CLASS}>
      <div className="flex flex-col gap-1">
        <PageTitle className="text-2xl">Account</PageTitle>
        <p className="text-sm text-muted">Signed in as {session.user.email}</p>
      </div>

      <AccountSection title="Profile">
        <AppLink href={`/users/${session.user.id}`}>View my profile</AppLink>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">Theme</span>
          <ThemeSelect />
        </div>
        <PrivateProfileToggle initialIsPrivate={user?.isPrivate ?? false} />
      </AccountSection>

      <AccountSection title="Send data">
        <AppLink href="/account/import">Import sends</AppLink>
        <ExportSendsButton userId={session.user.id} />
      </AccountSection>

      <AccountSection title="Session">
        <ResetPasswordButton email={session.user.email} />
        <SignOutButton />
      </AccountSection>

      <AccountSection title="Danger zone">
        <p className="text-sm text-muted">
          Export your sends above before deleting your account — this can&apos;t be undone.
        </p>
        <DeleteAccountButton />
      </AccountSection>
    </div>
  );
}
