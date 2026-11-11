"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { lightTint } from "@/components/dashboard/light-controls";
import type { Device } from "@/lib/devices/types";
import { HangingBulb } from "./hanging-bulb";
import styles from "./device-moment.module.css";

/** How long each moment holds the screen before the next, or the clock, comes back. */
const HOLD_MS = 3200;

type Moment =
  | { key: string; kind: "light"; name: string; on: boolean; tint: string | null }
  | { key: string; kind: "fan"; name: string; on: boolean };

/** The settled state worth a moment, or null for a device that has none or is still moving. */
function stateOf(device: Device): string | null {
  if (!device.available) return null;
  if (device.kind === "light" || device.kind === "fan") return device.on ? "on" : "off";
  return null;
}

function momentOf(device: Device, state: string): Moment | null {
  const key = `${device.id}-${state}-${Date.now()}`;
  if (device.kind === "light") return { key, kind: "light", name: device.name, on: state === "on", tint: lightTint(device) };
  if (device.kind === "fan") return { key, kind: "fan", name: device.name, on: state === "on" };
  return null;
}

const words = (moment: Moment) => `${moment.name} ${moment.on ? "on" : "off"}`;

/**
 * Full-screen moments on a resting wall tablet: a light or fan that changes plays a short scene of it changing, one
 * after another, then the clock comes back. It never wakes the screen. Locks and garage doors have their own notice,
 * `StateNotices`, which plays `LockScene` and `GarageScene`.
 */
export function DeviceMoments({ devices, active }: { devices: Device[] | undefined; active: boolean }) {
  const seen = useRef<Map<string, string> | null>(null);
  const [queue, setQueue] = useState<Moment[]>([]);
  useEffect(() => {
    if (!devices) return;
    const known = seen.current;
    const next = new Map<string, string>();
    const fresh: Moment[] = [];
    for (const device of devices) {
      const state = stateOf(device);
      if (state === null) { if (known?.has(device.id)) next.set(device.id, known.get(device.id)!); continue; }
      next.set(device.id, state);
      const before = known?.get(device.id);
      if (active && before !== undefined && before !== state) {
        const moment = momentOf(device, state);
        if (moment) fresh.push(moment);
      }
    }
    seen.current = next;
    if (!fresh.length) return;
    const timer = setTimeout(() => setQueue(current => [...current, ...fresh].slice(-4)), 0);
    return () => clearTimeout(timer);
  }, [devices, active]);

  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => setQueue(current => current.slice(1)), HOLD_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  // Waking the screen ends any moment still waiting; the queue drains on its own timer.
  const moment = active ? queue[0] : undefined;
  return (
    <AnimatePresence>
      {moment && (
        <motion.div key={moment.key} className={styles.moment} data-kind={moment.kind} role="status" aria-live="polite"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <Scene moment={moment} />
          <motion.p className={styles.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>{words(moment)}</motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Starts in the old state, then flips a beat later so the scene plays the change itself. */
function useFlip(target: boolean) {
  const [shown, setShown] = useState(!target);
  useEffect(() => {
    const timer = setTimeout(() => setShown(target), 260);
    return () => clearTimeout(timer);
  }, [target]);
  return shown;
}

function Scene({ moment }: { moment: Moment }) {
  return moment.kind === "light" ? <LightScene on={moment.on} tint={moment.tint} /> : <FanScene on={moment.on} />;
}

function LightScene({ on, tint }: { on: boolean; tint: string | null }) {
  const shown = useFlip(on);
  const reduce = useReducedMotion();
  return (
    <div className={styles.stage} style={{ "--glow": tint ?? "var(--lit-warm)" } as CSSProperties}>
      <motion.span className={styles.bloom} initial={false} animate={{ opacity: shown ? (reduce ? 1 : [0, .8, .2, 1, .6, 1]) : (reduce ? 0 : [1, .3, .7, .1, 0]) }}
        transition={{ duration: reduce ? 0 : shown ? .8 : .6, ease: "linear" }} aria-hidden="true" />
      <span className={styles.bulb}><HangingBulb on={shown} size={360} tint={tint} /></span>
    </div>
  );
}

function FanScene({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.stage}>
      <motion.svg viewBox="-100 -100 200 200" className={styles.fan} aria-hidden="true"
        initial={{ rotate: 0 }} animate={{ rotate: reduce ? 0 : on ? 1440 : 300 }} transition={{ duration: on ? 3 : 2.6, ease: on ? [.6, 0, 1, .7] : [0, .5, .3, 1] }}>
        {[0, 120, 240].map(angle => (
          <path key={angle} transform={`rotate(${angle})`} d="M 0 -8 C 22 -30 30 -78 8 -92 C -10 -98 -22 -70 -12 -40 C -8 -26 -4 -14 0 -8 Z" className={styles.blade} />
        ))}
        <circle r={14} className={styles.hub} />
      </motion.svg>
      <motion.span className={styles.breeze} initial={{ opacity: 0 }} animate={{ opacity: on ? [0, .7, .4] : [.4, 0] }} transition={{ duration: 2 }} aria-hidden="true" />
    </div>
  );
}

export function LockScene({ locked, small = false }: { locked: boolean; small?: boolean }) {
  const shown = useFlip(locked);
  const reduce = useReducedMotion();
  return (
    <div className={`${styles.stage} ${small ? styles.small : ""}`} data-locked={shown || undefined}>
      <motion.span className={styles.ring} initial={false} animate={shown && !reduce ? { scale: [0.6, 1.25], opacity: [0.7, 0] } : { opacity: 0 }} transition={{ duration: 1.1, delay: .25, ease: "easeOut" }} aria-hidden="true" />
      <svg viewBox="-60 -80 120 150" className={styles.lock} aria-hidden="true">
        <motion.path d="M -32 -6 L -32 -36 A 32 32 0 0 1 32 -36 L 32 -6" className={styles.shackle} initial={false}
          animate={reduce ? { y: shown ? 0 : -14, rotate: 0 } : shown ? { y: [-18, 2, 0], rotate: [0, 0, 0] } : { y: [0, -18, -18], rotate: [0, 0, -24] }}
          style={{ originX: "32px", originY: "-6px" }} transition={{ duration: .7, ease: "easeOut" }} />
        <rect x={-46} y={-8} width={92} height={74} rx={16} className={styles.body} />
        <circle cx={0} cy={22} r={9} className={styles.keyhole} />
        <rect x={-3} y={24} width={6} height={20} rx={3} className={styles.keyhole} />
      </svg>
    </div>
  );
}

export function GarageScene({ open, small = false }: { open: boolean; small?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={`${styles.stage} ${small ? styles.small : ""}`}>
      <svg viewBox="0 0 240 200" className={styles.garage} aria-hidden="true">
        <path d="M 10 70 L 120 12 L 230 70 L 230 196 L 10 196 Z" className={styles.house} />
        <clipPath id="garage-scene-opening"><rect x={40} y={86} width={160} height={110} /></clipPath>
        <rect x={40} y={86} width={160} height={110} className={styles.inside} />
        <motion.g clipPath="url(#garage-scene-opening)" initial={{ y: open ? 0 : -104 }} animate={{ y: open ? -104 : 0 }}
          transition={{ duration: reduce ? 0 : 2.2, ease: [.45, 0, .2, 1], delay: .25 }}>
          {[0, 1, 2, 3, 4].map(row => <rect key={row} x={42} y={88 + row * 21.6} width={156} height={19} rx={2} className={styles.panel} />)}
        </motion.g>
        <rect x={40} y={86} width={160} height={110} className={styles.frame} />
      </svg>
    </div>
  );
}
