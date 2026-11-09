import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { googleEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const failed = error === "google" ? "Google sign in did not finish. If sign up is closed, ask whoever runs Hearth to invite you first." : null;
  return <SignInForm next={safeNext(next)} google={googleEnabled} initialError={failed} />;
}
