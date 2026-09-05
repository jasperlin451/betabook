import type { Metadata } from "next";

import { requireAdminOrRedirect } from "./require-admin";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrRedirect();
  return children;
}
