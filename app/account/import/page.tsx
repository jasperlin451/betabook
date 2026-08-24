import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return <ImportWizard />;
}
