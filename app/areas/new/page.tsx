import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewAreaForm } from "@/components/new-area-form";
import { PageTitle } from "@/components/ui/typography";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Add area",
  robots: { index: false },
};

export default async function NewAreaPage() {
  const session = await getSession();
  if (!session) redirect(signInUrl("/areas/new"));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Add area</PageTitle>
      <NewAreaForm />
    </div>
  );
}
