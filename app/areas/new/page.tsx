import type { Metadata } from "next";

import { CurrentPageAuthCallout } from "@/components/current-page-auth-callout";
import { NewAreaForm } from "@/components/new-area-form";
import { PageTitle } from "@/components/ui/typography";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Add area",
  robots: { index: false },
};

export default async function NewAreaPage() {
  const session = await getSession();
  if (!session) return <CurrentPageAuthCallout />;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Add area</PageTitle>
      <NewAreaForm />
    </div>
  );
}
