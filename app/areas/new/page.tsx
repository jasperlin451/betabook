import { redirect } from "next/navigation";
import { NewAreaForm } from "@/components/new-area-form";
import { getSession } from "@/lib/session";

export default async function NewAreaPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold">New Area</h1>
      <NewAreaForm />
    </div>
  );
}
