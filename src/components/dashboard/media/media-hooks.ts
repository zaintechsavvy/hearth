"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTick } from "@/components/dashboard/household/use-tick";
import { paletteFromImage } from "@/components/shell/image-tools";
import { hexToHsl, hslToHex } from "@/lib/backgrounds/palette";
import { livePosition, type DeviceCommand, type MediaPlayerDevice } from "@/lib/devices/types";

export type Send = (command: DeviceCommand) => Promise<void>;
export type View = "controls" | "library" | "outputs" | "queue";

export interface Track {
  title: string;
  artist: string | null;
  media: { id: string; type: string } | null;
}

export const fetchJson = <T,>(url: string): Promise<T> => fetch(url).then(async response => {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "");
  return body as T;
});

export function useDebounced<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Where the track is now, moving once a second while it plays. */
export function usePosition(device: MediaPlayerDevice) {
  const now = useTick(device.state === "playing" ? 1000 : 60_000);
  return now === null ? device.position : livePosition(device, now);
}

export const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const tints = new Map<string, string | null>();
const tintListeners = new Set<() => void>();

/** The cover's most colourful tone, softened to sit behind text; null for grey covers, or until it has loaded. */
function loadTint(src: string) {
  if (tints.has(src)) return;
  tints.set(src, null);
  paletteFromImage(src, 5).then(colors => {
    const vivid = colors.map(hexToHsl).sort((a, b) => b[1] * (1 - Math.abs(b[2] - 0.5)) - a[1] * (1 - Math.abs(a[2] - 0.5)))[0];
    tints.set(src, vivid && vivid[1] > 0.14 ? hslToHex(vivid[0], Math.min(vivid[1], 0.62), 0.58) : null);
    for (const listener of tintListeners) listener();
  }).catch(() => {});
}

export function useCoverTint(src: string | null) {
  useEffect(() => { if (src) loadTint(src); }, [src]);
  return useSyncExternalStore(
    listener => { tintListeners.add(listener); return () => tintListeners.delete(listener); },
    () => (src ? tints.get(src) ?? null : null),
    () => null,
  );
}
