import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/sign-up-form";
import { getSession } from "@/lib/session";
import { safeNextPath } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

export default async function SignUpPage({
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
  return <SignUpForm next={nextPath} />;
}
