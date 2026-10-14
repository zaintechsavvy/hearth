"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Glass } from "@/components/glass/glass";
import { setOpenMethod } from "@/lib/actions";
import type { OpenMethod } from "@/lib/security-types";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

/** How unlocking a door, opening the garage, or disarming the alarm is confirmed, for everyone in the home. */
export function SecuritySection({ method, hasPin, owner }: { method: OpenMethod; hasPin: boolean; owner: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<OpenMethod>(method);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async (next: OpenMethod, newPin?: string) => {
    const result = await setOpenMethod(next, newPin);
    setError(result.ok ? null : result.error);
    setSaved(result.ok);
    if (result.ok) { setPin(""); router.refresh(); }
  };
  return (
    <SettingsSection id="security" title="Doors and alarm" description={<>How opening the home is confirmed.</>}>
      <Glass shape="panel" className={styles.group}>
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Unlocking, opening the garage, and disarming</span>
            <span className={styles.rowMeta}>{choice === "hold" ? "Hold a button for a second. Quick, and stops accidental taps." : "Enter the household PIN, so children and visitors cannot open the home."}</span>
          </div>
          <SegmentedControl label="Confirm with" value={choice} onValueChange={value => {
            const next = value as OpenMethod;
            setChoice(next);
            setSaved(false);
            if (owner && (next === "hold" || hasPin)) void save(next);
          }} options={[{ value: "hold", label: "Hold to confirm" }, { value: "pin", label: "PIN" }]} />
          {owner && choice === "pin" && (
            <form className={styles.inline} onSubmit={event => { event.preventDefault(); void save("pin", pin); }}>
              <Input label={hasPin ? "New PIN" : "PIN"} type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{4,8}" maxLength={8} value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, ""))} description="4 to 8 digits. Everyone in the household uses it." />
              <Button type="submit" variant="secondary" disabled={pin.length < 4}>{hasPin ? "Change PIN" : "Set PIN"}</Button>
            </form>
          )}
          {!owner && <span className={styles.rowMeta}>Only the owner can change this.</span>}
          <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
          {saved && <span className={styles.rowMeta} role="status">Saved.</span>}
        </div>
      </Glass>
    </SettingsSection>
  );
}
