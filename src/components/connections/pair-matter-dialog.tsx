"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { pairMatterDevice } from "@/lib/actions";
import { glassSheetClass } from "@/components/glass/glass";
import styles from "./connections.module.css";

interface PairMatterDialogProps {
  integration: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onPaired: () => void;
}

export function PairMatterDialog({ integration, onOpenChange, onPaired }: PairMatterDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integration) return;
    setPending(true);
    setError(null);
    const result = await pairMatterDevice(integration.id, String(new FormData(event.currentTarget).get("code")));
    setPending(false);
    if (!result.ok) return setError(result.error);
    setPaired(true);
    onPaired();
  }

  return (
    <Dialog open={Boolean(integration)} onOpenChange={open => { onOpenChange(open); if (!open) { setError(null); setPaired(false); } }}>
      <DialogContent className={glassSheetClass} title="Pair a Matter device" description={integration ? `Adds the device to ${integration.name}.` : undefined}>
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.help}>
            Already in Apple Home, Google Home, or Alexa? Open the device there, choose <strong>Turn on pairing mode</strong>, and paste the code it shows.
            New devices use the code printed on the label.
          </p>
          <Input label="Pairing code" name="code" inputMode="text" placeholder="3497-011-2332 or MT:Y.K90..." required autoComplete="off" disabled={pending || paired} />
          <Alert tone="danger" title="Pairing failed" open={Boolean(error)}>{error ?? ""}</Alert>
          <Alert tone="success" title="Device paired" open={paired}>It will appear on your dashboard in a moment.</Alert>
          <div className={styles.formActions}>
            {pending && <TextShimmer className={styles.help}>This can take up to a minute</TextShimmer>}
            <DialogClose asChild><Button type="button" variant="ghost">{paired ? "Done" : "Cancel"}</Button></DialogClose>
            {!paired && <Button type="submit" loading={pending}>Pair device</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
