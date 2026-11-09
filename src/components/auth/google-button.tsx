"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { authClient } from "@/lib/auth-client";
import styles from "./auth-card.module.css";

export function GoogleButton({ next, onError }: { next: string | null; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next ?? "/dashboard", errorCallbackURL: "/sign-in?error=google" });
    if (error) {
      onError(error.message ?? "Google sign in did not finish. Try again.");
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" size="lg" loading={pending} onClick={start} className={styles.submit}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4.01-3.1Z" />
          <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
        </svg>
        Continue with Google
      </Button>
      <div className={styles.divider} role="separator">or</div>
    </>
  );
}
