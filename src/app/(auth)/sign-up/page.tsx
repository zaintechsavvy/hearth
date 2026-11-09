import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { googleEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return <SignUpForm next={safeNext(next)} google={googleEnabled} />;
}
