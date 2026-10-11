"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Select } from "@/components/arc/select/select";
import { Glass } from "@/components/glass/glass";
import { authClient } from "@/lib/auth-client";
import { ACCENTS, ACCENT_KEY, type Accent } from "@/lib/theme";
import styles from "./connections.module.css";

const EVENT = "hearth-accent";
const DEFAULT_ACCENT: Accent = "orange";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const label = (accent: Accent) => accent[0].toUpperCase() + accent.slice(1);

export function AccountSection({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const accent = useSyncExternalStore(subscribe, () => (localStorage.getItem(ACCENT_KEY) as Accent | null) ?? DEFAULT_ACCENT, () => DEFAULT_ACCENT);

  const setAccent = (next: string) => {
    localStorage.setItem(ACCENT_KEY, next);
    document.documentElement.dataset.accent = next;
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <section className={styles.section} aria-labelledby="account-title">
      <div className={styles.sectionHeader}>
        <h2 id="account-title" className={styles.sectionTitle}>Account</h2>
      </div>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{user.name}</span>
            <span className={styles.rowMeta}>{user.email}</span>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Accent</span>
            <span className={styles.rowMeta}>Colours switches, sliders, and active devices.</span>
          </div>
          <div className={styles.rowActions}>
            <Select label="Accent" value={accent} onValueChange={setAccent} options={ACCENTS.map(value => ({ value, label: label(value) }))} />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Delete account</span>
            <span className={styles.rowMeta}>Removes your connections, cameras, and preferences from this Hearth.</span>
          </div>
          <div className={styles.rowActions}>
            <ConfirmMorph label="Delete account" prompt="Delete your account?" confirmMode="hold" pendingLabel="Deleting" doneLabel="Deleted" onConfirm={async () => {
              const { error } = await authClient.deleteUser();
              if (error) throw new Error(error.message);
              router.replace("/");
              router.refresh();
            }} />
          </div>
        </div>
      </Glass>
    </section>
  );
}
