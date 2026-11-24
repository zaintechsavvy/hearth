"use client";

import { motion } from "motion/react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MediaPlayerDevice, RepeatMode } from "@/lib/devices/types";
import type { Send } from "./media-hooks";
import styles from "./media-tile.module.css";

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };
const REPEAT_LABEL: Record<RepeatMode, string> = { off: "Repeat", all: "Repeating all", one: "Repeating this track" };

/** `bar` keeps play and next, `mini` adds previous, and `large` adds shuffle and repeat. Only the morphing one has `morph`. */
export function Transport({ device, send, disabled, size, morph = false, autoFocus }: { device: MediaPlayerDevice; send: Send; disabled: boolean; size: "bar" | "mini" | "large"; morph?: boolean; autoFocus?: boolean }) {
  const playing = device.state === "playing";
  const lead = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) lead.current?.focus({ preventScroll: true }); }, [autoFocus]);
  const icon = size === "large" ? 26 : 18;
  const repeat = device.repeat ?? "off";
  const large = size === "large";
  return (
    <motion.span layoutId={morph ? "ops" : undefined} layout={morph ? "position" : undefined} className={styles.ops} data-size={size}>
      {large && device.can.shuffle && (
        <button type="button" className={styles.mode} data-on={device.shuffle || undefined} aria-pressed={Boolean(device.shuffle)} aria-label="Shuffle" disabled={disabled} onClick={() => void send({ type: "shuffle", on: !device.shuffle })}>
          <Shuffle size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
      {device.can.previous && (
        <button type="button" className={styles.op} data-side data-previous aria-label="Previous" disabled={disabled} onClick={() => void send({ type: "media", action: "previous" })}>
          <SkipBack size={icon} strokeWidth={1.75} fill="currentColor" strokeLinejoin="round" aria-hidden="true" />
        </button>
      )}
      <button ref={lead} type="button" className={styles.op} data-lead aria-label={playing ? "Pause" : "Play"} disabled={disabled} onClick={() => void send({ type: "media", action: playing ? "pause" : "play" })}>
        {playing ? <Pause size={icon} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={icon} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" />}
      </button>
      {device.can.next && (
        <button type="button" className={styles.op} data-side aria-label="Next" disabled={disabled} onClick={() => void send({ type: "media", action: "next" })}>
          <SkipForward size={icon} strokeWidth={1.75} fill="currentColor" strokeLinejoin="round" aria-hidden="true" />
        </button>
      )}
      {large && device.can.repeat && (
        <button type="button" className={styles.mode} data-on={repeat !== "off" || undefined} aria-pressed={repeat !== "off"} aria-label={REPEAT_LABEL[repeat]} disabled={disabled}
          onClick={() => void send({ type: "repeat", mode: NEXT_REPEAT[repeat] })}>
          {repeat === "one" ? <Repeat1 size={20} strokeWidth={1.75} aria-hidden="true" /> : <Repeat size={20} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      )}
    </motion.span>
  );
}
