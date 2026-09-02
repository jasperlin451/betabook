import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Import sends",
};

export default async function ImportPage() {
  const session = await getSession();

  if (!session) {
    redirect(signInUrl("/account/import"));
  }

  return <ImportWizard profileHref={`/users/${session.user.id}`} />;
}
