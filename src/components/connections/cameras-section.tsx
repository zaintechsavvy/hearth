"use client";

import { Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Glass, glassSheetClass } from "@/components/glass/glass";
import { addCamera, removeCamera, saveStreamRelay } from "@/lib/actions";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export interface CameraSummary {
  id: string;
  name: string;
  host: string;
}

const RELAY = "relay";

/**
 * RTSP cameras. With Home Assistant connected they are added to it as Generic Cameras, so its built-in go2rtc streams
 * them and Hearth plays them like any other Home Assistant camera, even from a hosted Hearth. Otherwise, or by choice,
 * they go through a go2rtc relay this server can reach.
 */
export function CamerasSection({ cameras, relayUrl, homeAssistants }: { cameras: CameraSummary[]; relayUrl: string; homeAssistants: { id: string; name: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [via, setVia] = useState(homeAssistants[0]?.id ?? RELAY);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relay, setRelay] = useState({ value: relayUrl, pending: false, error: null as string | null, saved: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await addCamera({
      name: String(form.get("name")),
      url: String(form.get("url")).trim(),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      integrationId: via === RELAY ? undefined : via,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setAdding(false);
    setAdded(via === RELAY ? null : String(form.get("name")));
    router.refresh();
  }

  async function saveRelay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRelay(current => ({ ...current, pending: true, error: null, saved: false }));
    const result = await saveStreamRelay(relay.value);
    setRelay(current => ({ ...current, pending: false, error: result.ok ? null : result.error, saved: result.ok }));
  }

  return (
    <SettingsSection id="cameras" title="Cameras" description={homeAssistants.length ? <>RTSP cameras, streamed by Home Assistant or your own go2rtc relay.</> : <>RTSP cameras through a go2rtc relay.</>} action={<Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add</Button>}>

      <Alert tone="success" title={`${added} is in Home Assistant`} open={Boolean(added)}>Add it to the dashboard with Add tile, then Camera.</Alert>
      <Glass shape="panel" className={styles.group}>
        <form className={styles.row} onSubmit={saveRelay}>
          <div className={styles.inline} style={{ flex: 1 }}>
            <Input
              label="Stream relay"
              value={relay.value}
              onChange={event => setRelay(current => ({ ...current, value: event.target.value, saved: false }))}
              placeholder="http://192.168.1.10:1984"
              error={relay.error ?? undefined}
              description={relay.saved ? "Connected. Cameras will stream through this relay." : "The go2rtc address, reachable from this server."}
            />
            <Button type="submit" variant="secondary" loading={relay.pending}>{relay.saved ? "Saved" : "Save"}</Button>
          </div>
        </form>
        {cameras.length === 0 ? (
          <div className={styles.row}>
            <EmptyState className={styles.empty} icon={<Video size={24} strokeWidth={1.75} />} title="No cameras yet" description="Add an RTSP camera with its address, username, and password." />
          </div>
        ) : cameras.map(camera => (
          <div key={camera.id} className={styles.row}>
            <Video className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{camera.name}</span>
              <span className={styles.rowMeta}>{camera.host}</span>
            </div>
            <div className={styles.rowActions}>
              <ConfirmMorph label="Remove" prompt={`Remove ${camera.name}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => {
                const result = await removeCamera(camera.id);
                if (!result.ok) throw new Error(result.error);
                router.refresh();
              }} />
            </div>
          </div>
        ))}
      </Glass>

      <Dialog open={adding} onOpenChange={open => { setAdding(open); if (!open) setError(null); }}>
        <DialogContent className={glassSheetClass} title="Add a camera" description={via === RELAY ? "Credentials are encrypted and only shared with your stream relay." : "Home Assistant checks the stream, then keeps the camera and its password."}>
          <form className={styles.form} onSubmit={submit}>
            {homeAssistants.length > 0 && (
              <SegmentedControl label="Stream it through" value={via} onValueChange={setVia}
                options={[...homeAssistants.map(item => ({ value: item.id, label: homeAssistants.length > 1 ? item.name : "Home Assistant" })), { value: RELAY, label: "go2rtc relay" }]} />
            )}
            <Input label="Name" name="name" placeholder="Front door" required autoComplete="off" />
            <Input label="RTSP address" name="url" placeholder="rtsp://192.168.1.20:554/stream1" required autoComplete="off" description="Find it in your camera's app or manual. Leave the username and password out of it." />
            <Input label="Username" name="username" autoComplete="off" />
            <PasswordField label="Password" name="password" autoComplete="new-password" />
            <Alert tone="danger" title="Could not add the camera" open={Boolean(error)}>{error ?? ""}</Alert>
            <div className={styles.formActions}>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" loading={pending}>Add camera</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
