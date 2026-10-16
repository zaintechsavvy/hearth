"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DoorOpen } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass } from "@/components/glass/glass";
import type { Device } from "@/lib/devices/types";
import { isDark, openThings } from "@/lib/left-open";
import { localDay } from "@/lib/widgets/schedules";
import styles from "./left-open.module.css";

const SINCE_KEY = "hearth-open-since";
const QUIET_KEY = "hearth-open-quiet";

export interface LeftOpen {
  device: Device;
  minutes: number;
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const write = (key: string, value: object) => {
  localStorage.setItem(key, JSON.stringify(value));
  for (const listener of listeners) listener();
};
const parse = <T,>(text: string): T => { try { return JSON.parse(text) as T; } catch { return {} as T; } };
const useStoredMap = <T,>(key: string) => parse<Record<string, T>>(useSyncExternalStore(subscribe, () => localStorage.getItem(key) ?? "{}", () => "{}"));

/** The night a moment belongs to, so "not tonight" lasts until morning even past midnight. */
const nightOf = (now: number) => localDay(new Date(now - 12 * 3_600_000));

/**
 * What has stood open too long after dark, on this wall tablet. Open times are remembered on the device, so a reload
 * does not restart the count, and "not tonight" quiets one until morning.
 */
export function useLeftOpen(devices: Device[] | undefined, now: number, sun: { sunrise: string; sunset: string } | null, nightWindow: boolean, minutes: number, enabled: boolean) {
  const since = useStoredMap<number>(SINCE_KEY);
  const quiet = useStoredMap<string>(QUIET_KEY);
  const open = openThings(devices ?? []);
  const loaded = devices !== undefined;
  const openIds = open.map(device => device.id).join("|");

  useEffect(() => {
    if (!loaded) return;
    const stored = parse<Record<string, number>>(localStorage.getItem(SINCE_KEY) ?? "{}");
    const ids = openIds ? openIds.split("|") : [];
    const next = Object.fromEntries(ids.map(id => [id, stored[id] ?? Date.now()]));
    if (JSON.stringify(next) !== JSON.stringify(stored)) write(SINCE_KEY, next);
  }, [loaded, openIds]);

  const quietTonight = (id: string) => write(QUIET_KEY, { ...quiet, [id]: nightOf(now) });

  if (!enabled || !now || !isDark(new Date(now), sun, nightWindow)) return { items: [] as LeftOpen[], quietTonight };
  const items = open.flatMap(device => {
    const start = since[device.id];
    const open = start ? Math.floor((now - start) / 60_000) : 0;
    return start && open >= minutes && quiet[device.id] !== nightOf(now) ? [{ device, minutes: open }] : [];
  });
  return { items, quietTonight };
}

export const leftOpenWords = ({ device, minutes }: LeftOpen) => `${device.name} has been open for ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`}`;

/** A gentle note at the top of the wall tablet, with a way to close what Hearth can close. */
export function LeftOpenBanner({ items, onClose, onQuiet }: { items: LeftOpen[]; onClose: (device: Device) => void; onQuiet: (id: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.stack} aria-live="polite">
      <AnimatePresence>
        {items.map(item => (
          <motion.div key={item.device.id} role="status" className={`${glassClass("pill")} ${styles.banner}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
            <span className={styles.icon} aria-hidden="true"><DoorOpen size={18} strokeWidth={1.75} /></span>
            <span className={styles.text}>{leftOpenWords(item)}<span className={styles.sub}>{item.device.room ?? "It is dark out"}</span></span>
            <Button size="sm" variant="ghost" onClick={() => onQuiet(item.device.id)}>Not tonight</Button>
            {item.device.kind === "cover" && <Button size="sm" onClick={() => onClose(item.device)}>Close</Button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
