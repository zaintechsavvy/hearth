"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Glass } from "@/components/glass/glass";
import { authClient } from "@/lib/auth-client";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export function AccountSection({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  return (
    <SettingsSection id="account" title="Account" description={<>{user.name} · {user.email}</>}>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{user.name}</span>
            <span className={styles.rowMeta}>{user.email}</span>
          </div>
          <div className={styles.rowActions}>
            <Button variant="secondary" onClick={async () => {
              await authClient.signOut();
              router.replace("/sign-in");
              router.refresh();
            }}>Sign out</Button>
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
    </SettingsSection>
  );
}
