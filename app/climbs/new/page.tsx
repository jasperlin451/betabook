import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewClimbForm } from "@/components/new-climb-form";
import { getSession } from "@/lib/session";
import { signInUrl } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "New Climb",
};

export default async function NewClimbPage() {
  const session = await getSession();
  if (!session) redirect(signInUrl("/climbs/new"));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New Climb</h1>
      <NewClimbForm />
    </div>
  );
}
