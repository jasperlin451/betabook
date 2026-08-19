import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { initAuth } from "@/lib/auth";
import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage() {
  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  return <ImportWizard />;
}
