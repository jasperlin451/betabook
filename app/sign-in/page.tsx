import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getSession } from "@/lib/session";
import { safeNextPath } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await getSession();
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (session) {
    redirect(nextPath ?? `/users/${session.user.id}`);
  }
  return <SignInForm next={nextPath} />;
}
