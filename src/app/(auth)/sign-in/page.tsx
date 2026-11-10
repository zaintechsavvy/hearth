import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(next)} />;
}
