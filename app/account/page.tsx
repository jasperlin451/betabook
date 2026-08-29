import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";
import { AppLink } from "@/components/ui/app-link";
import { ExportSendsButton } from "@/components/export-sends-button";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    redirect(signInUrl("/account"));
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-sm text-muted">Signed in as {session.user.email}</p>
      <AppLink href={`/users/${session.user.id}`}>View my profile</AppLink>
      <AppLink href="/account/import">Import Sends</AppLink>
      <ExportSendsButton userId={session.user.id} />
      <ResetPasswordButton email={session.user.email} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">Theme</span>
        <ThemeToggle />
      </div>
      <SignOutButton />
    </div>
  );
}
