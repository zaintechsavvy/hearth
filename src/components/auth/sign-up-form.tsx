"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordStrength, createPasswordRules } from "@/components/arc/password-strength/password-strength";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-policy";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "./auth-card";
import { GoogleButton } from "./google-button";
import styles from "./auth-card.module.css";

const MIN_LEVEL = 2;
const rules = createPasswordRules({ minLength: MIN_PASSWORD_LENGTH });

export function SignUpForm({ next = null, google = false, initialError = null }: { next?: string | null; google?: boolean; initialError?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [level, setLevel] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) {
      setError(error.message ?? "We could not create your account. Try again.");
      setPending(false);
      return;
    }
    router.replace(next ?? "/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      next={next}
      title="Make yourself at home"
      description="Create an account to start connecting your devices."
      footer={{ prompt: "Already have an account?", href: "/sign-in", label: "Sign in" }}
    >
      {google && <GoogleButton next={next} onError={setError} />}
      <form className={styles.form} onSubmit={submit}>
        <Input label="Name" name="name" autoComplete="name" required autoFocus />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <PasswordStrength label="Password" name="password" autoComplete="new-password" required rules={rules} shortLength={MIN_PASSWORD_LENGTH} onValueChange={(_, strength) => setLevel(strength.level)} />
        <Alert tone="danger" title="Could not create your account" open={Boolean(error)}>{error ?? ""}</Alert>
        <Button type="submit" size="lg" loading={pending} disabled={level < MIN_LEVEL} className={styles.submit}>Create account</Button>
      </form>
    </AuthCard>
  );
}
