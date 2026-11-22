"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Slider } from "@/components/arc/slider/slider";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { Send } from "./media-hooks";
import styles from "./media-tile.module.css";

/** Moving the slider while muted unmutes, as a phone does. */
export function VolumeControl({ device, send, disabled }: { device: MediaPlayerDevice; send: Send; disabled: boolean }) {
  const [draft, setDraft] = useState<number | null>(null);
  const muted = Boolean(device.muted);
  const value = draft ?? (muted ? 0 : device.volume ?? 0);
  const Low = muted || value === 0 ? VolumeX : Volume1;
  const mute = device.can.mute ? (
    <button type="button" className={styles.mute} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} disabled={disabled} onClick={() => void send({ type: "mute", on: !muted })}>
      <Low size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  ) : <Low size={18} strokeWidth={1.75} aria-hidden="true" />;
  return (
    <div className={styles.volume} data-muted={muted || undefined}>
      <Slider label="Volume" value={value} min={0} max={100} showValue={false} disabled={disabled} format={level => `${level}%`}
        start={mute} end={<Volume2 size={18} strokeWidth={1.75} aria-hidden="true" />}
        onValueChange={setDraft}
        onValueCommit={level => {
          setDraft(level);
          if (muted && level > 0) void send({ type: "mute", on: false });
          void send({ type: "volume", value: level }).finally(() => setDraft(null));
        }} />
    </div>
  );
}
