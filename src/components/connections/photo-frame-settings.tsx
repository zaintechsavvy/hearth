"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { useHome } from "@/components/dashboard/use-home";
import { resizeImage, uploadPhoto } from "@/components/shell/image-tools";
import { removeImmich, saveImmich } from "@/lib/actions";
import type { PhotoSource, WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";

const fetchList = async (url: string) => {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Photos did not load.");
  return body as { name: string; photos: unknown[] };
};

/** The resting screen as a photo frame: where the photos come from, how long each shows, and whether they show at night. */
export function PhotoFrameSettings({ settings, set }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void }) {
  const { home } = useHome();
  const { mutate } = useSWRConfig();
  const source = settings.frameSource;
  const listKey = `/api/photos?source=${source}`;
  const { data, error } = useSWR(settings.frame && (source === "uploads" || home?.photoAlbum) ? listKey : null, fetchList);
  const [uploading, setUploading] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setProblem(null);
    const controller = new AbortController();
    try {
      for (const [index, file] of [...files].entries()) {
        setUploading(`Adding ${index + 1} of ${files.length}`);
        await uploadPhoto(await resizeImage(file), () => {}, controller.signal);
      }
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "A photo did not upload.");
    }
    setUploading(null);
    await mutate(listKey);
  };

  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Photo frame</span>
        <span className={styles.rowMeta}>Rest on your photos, drifting slowly from one to the next, with the clock in the corner.</span>
      </div>
      <Switch label="Show photos while resting" checked={settings.frame} onCheckedChange={frame => set({ frame })} />
      {settings.frame && (
        <>
          <SegmentedControl label="Photos from" value={source} onValueChange={value => set({ frameSource: value as PhotoSource })}
            options={[{ value: "uploads", label: "Your photos" }, { value: "immich", label: "Immich album" }]} />
          {source === "uploads" ? (
            <div className={styles.inline}>
              <span className={styles.rowMeta}>{uploading ?? (data ? `${data.photos.length} ${data.photos.length === 1 ? "photo" : "photos"}. They can be backgrounds too.` : "Photos you add here show on this frame.")}</span>
              <input ref={picker} type="file" accept="image/*" multiple hidden onChange={event => { void upload(event.target.files); event.target.value = ""; }} />
              <Button variant="secondary" loading={Boolean(uploading)} onClick={() => picker.current?.click()}><ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />Add photos</Button>
            </div>
          ) : home?.photoAlbum ? (
            <div className={styles.inline}>
              <span className={styles.rowMeta}>{error ? error.message : data ? `${data.name} · ${data.photos.length} photos` : "Connected to Immich."}</span>
              <ConfirmMorph label="Disconnect" prompt="Disconnect the Immich album?" confirmLabel="Disconnect" pendingLabel="Disconnecting" doneLabel="Disconnected"
                onConfirm={async () => { const result = await removeImmich(); if (!result.ok) throw new Error(result.error); await mutate("/api/home"); }} />
            </div>
          ) : <ImmichForm onSaved={() => void mutate("/api/home")} />}
          <Alert tone="danger" title="Could not add a photo" open={Boolean(problem)}>{problem ?? ""}</Alert>
          <Slider label="Each photo" value={settings.frameSeconds} min={10} max={120} step={5} format={value => `${value} s`} onValueChange={frameSeconds => set({ frameSeconds })} />
          <Switch label="Photos at night too" checked={settings.frameAtNight} onCheckedChange={frameAtNight => set({ frameAtNight })} />
        </>
      )}
    </div>
  );
}

function ImmichForm({ onSaved }: { onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await saveImmich({ url: String(form.get("url") ?? ""), key: String(form.get("key") ?? ""), album: String(form.get("album") ?? "") });
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <Input label="Immich address" name="url" type="url" placeholder="https://photos.example.com" required autoComplete="off" />
      <PasswordField label="API key" name="key" required autoComplete="off" description="In Immich: Account settings, API keys. It needs album.read and asset.view." />
      <Input label="Album" name="album" placeholder="https://photos.example.com/albums/…" required autoComplete="off" description="Open the album in Immich and copy its address." />
      <Alert tone="danger" title="Could not connect" open={Boolean(error)}>{error ?? ""}</Alert>
      <div className={styles.formActions}><Button type="submit" variant="secondary" loading={pending}>Connect album</Button></div>
    </form>
  );
}
