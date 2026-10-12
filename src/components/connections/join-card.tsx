"use client";

import { House, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Glass } from "@/components/glass/glass";
import { acceptInvite } from "@/lib/household-actions";
import styles from "./connections.module.css";

/** Accepting a household invite: who it is from, what it allows, and one button. */
export function JoinCard({ code, ownerName, role, own, current }: { code: string; ownerName: string | null; role: "member" | "guest" | null; own: boolean; current: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ownerName || !role) {
    return <Glass shape="panel" className={styles.join}><EmptyState icon={<House size={24} strokeWidth={1.75} />} title="This invite has expired" description="Invites last a week and work once. Ask for a new link." /></Glass>;
  }
  const first = ownerName.split(" ")[0];
  return (
    <Glass shape="panel" className={styles.join}>
      <UserRoundPlus className={styles.joinIcon} size={28} strokeWidth={1.75} aria-hidden="true" />
      <h1 className={styles.joinTitle}>{own ? "This is your own invite" : `Join ${first}'s home`}</h1>
      <p className={styles.joinText}>
        {own ? "Send this link to the person you are inviting."
          : role === "member" ? `You will see and control everything in ${first}'s home, and get its alerts. ${first} keeps the connections and assistants.`
            : `You will see the pages ${first} chose for you and can switch things on them. Doors stay locked.`}
        {current && !own ? ` You will leave ${current}'s home.` : ""}
      </p>
      <Alert tone="danger" title="Could not join" open={Boolean(error)}>{error ?? ""}</Alert>
      {!own && (
        <Button loading={pending} onClick={async () => {
          setPending(true);
          const result = await acceptInvite(code);
          setPending(false);
          if (!result.ok) return setError(result.error);
          router.replace("/dashboard");
          router.refresh();
        }}>Join as {role === "member" ? "a member" : "a guest"}</Button>
      )}
    </Glass>
  );
}
