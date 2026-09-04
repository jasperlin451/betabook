import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotSignedInError } from "@/lib/action-result";
import { requireAdmin } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotSignedInError) redirect(signInUrl("/admin/requests"));
    redirect("/");
  }

  return children;
}
