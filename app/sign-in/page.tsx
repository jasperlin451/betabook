import type { Metadata } from "next";

import { SignInForm } from "@/components/sign-in-form";
import { safeNextPath } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignInForm next={safeNextPath(next)} />;
}
