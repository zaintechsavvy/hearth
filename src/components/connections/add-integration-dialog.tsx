"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { addIntegration } from "@/lib/actions";
import type { IntegrationKind } from "@/lib/integrations/types";
import { glassSheetClass } from "@/components/glass/glass";
import styles from "./connections.module.css";

const KINDS = [
  { value: "home-assistant", label: "Home Assistant", description: "Lights, switches, fans, and climate through the REST API." },
  { value: "matter", label: "Matter server", description: "Talk to Matter devices directly. The Home Assistant Matter add-on runs one." },
  { value: "demo", label: "Demo home", description: "Simulated devices to explore Hearth without hardware." },
] satisfies { value: IntegrationKind; label: string; description: string }[];

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddIntegrationDialog({ open, onOpenChange, onAdded }: AddIntegrationDialogProps) {
  const [kind, setKind] = useState<IntegrationKind>("home-assistant");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await addIntegration({ kind, name: String(form.get("name") ?? ""), url: form.get("url") ?? undefined, token: form.get("token") ?? undefined });
    setPending(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) setError(null); }}>
      <DialogContent className={glassSheetClass} title="Add a connection" description="Hearth checks the connection before saving it.">
        <form className={styles.form} onSubmit={submit}>
          <RadioCards aria-label="Connection type" layout="list" value={kind} onValueChange={value => { setKind(value as IntegrationKind); setError(null); }} options={KINDS} />
          <Input label="Name" name="name" placeholder={KINDS.find(item => item.value === kind)?.label} autoComplete="off" />
          {kind === "home-assistant" && (
            <>
              <Input key="ha-url" label="Address" name="url" type="url" placeholder="http://homeassistant.local:8123" required autoComplete="off" />
              <PasswordField label="Long-lived access token" name="token" required autoComplete="off" description="In Home Assistant, open your profile, then Security, then Create token." />
            </>
          )}
          {kind === "matter" && (
            <Input key="matter-url" label="Matter server address" name="url" placeholder="ws://homeassistant.local:5580/ws" required autoComplete="off" description="Home Assistant users: enable the Matter Server add-on and expose port 5580." />
          )}
          <Alert tone="danger" title="Could not connect" open={Boolean(error)}>{error ?? ""}</Alert>
          <div className={styles.formActions}>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" loading={pending}>{kind === "demo" ? "Add demo home" : "Connect"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
