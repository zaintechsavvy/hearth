"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "./auth-card";
import { GoogleButton } from "./google-button";
import styles from "./auth-card.module.css";

export function SignInForm({ next = null, google = false, initialError = null }: { next?: string | null; google?: boolean; initialError?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(error.status === 401 ? "That email and password do not match." : error.message ?? "Sign in failed. Try again.");
      setPending(false);
      return;
    }
    router.replace(next ?? "/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      next={next}
      title="Welcome home"
      description="Sign in to see your rooms, cameras, and climate."
      footer={{ prompt: "New to Hearth?", href: "/sign-up", label: "Create an account" }}
    >
      {google && <GoogleButton next={next} onError={setError} />}
      <form className={styles.form} onSubmit={submit}>
        <Input label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <PasswordField label="Password" name="password" autoComplete="current-password" required />
        <Alert tone="danger" title="Could not sign in" open={Boolean(error)}>{error ?? ""}</Alert>
        <Button type="submit" size="lg" loading={pending} className={styles.submit}>Sign in</Button>
      </form>
    </AuthCard>
  );
}
