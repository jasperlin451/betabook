import type { Metadata } from "next";

import { SignUpForm } from "@/components/sign-up-form";
import { safeNextPath } from "@/lib/sign-in-redirect";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignUpForm next={safeNextPath(next)} />;
}
