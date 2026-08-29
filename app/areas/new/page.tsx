import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewAreaForm } from "@/components/new-area-form";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "New Area",
};

export default async function NewAreaPage() {
  const session = await getSession();
  if (!session) redirect(signInUrl("/areas/new"));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New Area</h1>
      <NewAreaForm />
    </div>
  );
}
