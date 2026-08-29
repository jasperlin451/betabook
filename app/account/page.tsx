import { redirect } from "next/navigation";
import { Link } from "@heroui/react";
import { getSession } from "@/lib/session";
import { ExportSendsButton } from "@/components/export-sends-button";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-surface-secondary p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-sm text-muted">Signed in as {session.user.email}</p>
      <Link href={`/users/${session.user.id}`}>View my profile</Link>
      <Link href="/account/import">Import Sends</Link>
      <ExportSendsButton />
      <ResetPasswordButton email={session.user.email} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">Theme</span>
        <ThemeToggle />
      </div>
      <SignOutButton />
    </div>
  );
}
