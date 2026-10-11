"use client";

import { useRouter } from "next/navigation";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Glass } from "@/components/glass/glass";
import { authClient } from "@/lib/auth-client";
import styles from "./connections.module.css";

export function AccountSection({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
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
