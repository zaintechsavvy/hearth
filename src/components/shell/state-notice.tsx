"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Device } from "@/lib/devices/types";
import { haptic } from "@/lib/haptics";
import { sentHere } from "@/lib/sent-here";
import { DoorScene, GarageScene, LockScene, WindowScene } from "./device-moment";
import styles from "./state-notice.module.css";

const SHOW_MS = 5000;
const OPENINGS = new Set(["door", "window", "garage", "opening"]);
const ENTRY_COVERS = new Set(["garage", "gate", "door"]);

type Picture = "garage" | "lock" | "door" | "window" | "leak";

interface Notice {
  key: string;
  name: string;
  room: string | null;
  words: string;
  picture: Picture;
  /** True for the change that opens the home, which the picture plays forwards. */
  open: boolean;
  /** A leak: it stays until someone taps it, in the alert colour. */
  alarm: boolean;
}

/** The settled state worth announcing for a device, or null for ones the wall stays quiet about. */
function stateOf(device: Device): { open: boolean; words: string; picture: Picture; alarm?: boolean } | null {
  if (!device.available) return null;
  if (device.kind === "binary_sensor" && device.sensorClass === "leak") {
    return { open: device.active, words: device.active ? "is wet" : "is dry again", picture: "leak", alarm: device.active };
  }
  if (device.kind === "lock") {
    if (device.state === "locked") return { open: false, words: "locked", picture: "lock" };
    if (device.state === "unlocked" || device.state === "open") return { open: true, words: "unlocked", picture: "lock" };
    return null;
  }
  if (device.kind === "cover" && ENTRY_COVERS.has(device.coverClass)) {
    if (device.state === "open") return { open: true, words: "opened", picture: device.coverClass === "garage" ? "garage" : "door" };
    if (device.state === "closed") return { open: false, words: "closed", picture: device.coverClass === "garage" ? "garage" : "door" };
    return null;
  }
  if (device.kind === "binary_sensor" && OPENINGS.has(device.sensorClass)) {
    return { open: device.active, words: device.active ? "opened" : "closed", picture: device.sensorClass === "garage" ? "garage" : device.sensorClass === "window" ? "window" : "door" };
  }
  return null;
}

/**
 * On a wall tablet, a lock, garage door, or door that changes somewhere else takes the screen for a few seconds with
 * a picture of what happened. Changes made on this screen stay quiet, and a tap puts the screen back at once.
 */
export function StateNotices({ devices }: { devices: Device[] | undefined }) {
  const reduce = useReducedMotion();
  const last = useRef<Map<string, boolean> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!devices) return;
    const now = new Map<string, boolean>();
    let next: Notice | null = null;
    for (const device of devices) {
      const state = stateOf(device);
      if (!state) continue;
      now.set(device.id, state.open);
      const before = last.current?.get(device.id);
      if (last.current && before !== undefined && before !== state.open && (state.picture === "leak" || !sentHere(device.id))) {
        next = { key: `${device.id}:${Date.now()}`, name: device.name, room: device.room, ...state, alarm: state.alarm ?? false };
      }
    }
    last.current = new Map([...(last.current ?? []), ...now]);
    if (!next) return;
    const shown = next;
    const timer = setTimeout(() => {
      setNotice(current => current?.alarm && !shown.alarm ? current : shown);
      haptic(shown.alarm ? "alert" : shown.open ? "press" : "tap");
    }, 0);
    return () => clearTimeout(timer);
  }, [devices]);

  useEffect(() => {
    if (!notice || notice.alarm) return;
    const timer = setTimeout(() => setNotice(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.button type="button" key={notice.key} className={styles.notice} data-open={notice.open || undefined} data-alarm={notice.alarm || undefined} data-still={reduce || undefined}
          onClick={() => setNotice(null)} aria-label={`${notice.name} ${notice.words}. Tap to close.`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.35 }}>
          <motion.span className={styles.card} initial={reduce ? false : { y: 16, scale: .97 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
            <span className={styles.art} aria-hidden="true">{notice.picture === "garage" ? <GarageScene small open={notice.open} /> : notice.picture === "lock" ? <LockScene small locked={!notice.open} /> : notice.picture === "leak" ? <Leak /> : notice.picture === "window" ? <WindowScene small open={notice.open} /> : <DoorScene small open={notice.open} />}</span>
            <span className={styles.words}>
              <span className={styles.title}>{notice.alarm ? "Water leak" : `${notice.name} ${notice.words}`}</span>
              <span className={styles.meta}>
                <span className={styles.dot} aria-hidden="true" />
                {notice.alarm ? `${[notice.name, notice.room].filter(Boolean).join(" · ")}. Check it now, then tap to close.` : [notice.room, "just now"].filter(Boolean).join(" · ")}
              </span>
            </span>
          </motion.span>
          {!notice.alarm && <span className={styles.timer} aria-hidden="true" />}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** A drop of water, with a ring spreading out under it while it is wet. */
function Leak() {
  return (
    <svg viewBox="0 0 120 100" className={styles.svg}>
      <ellipse cx="60" cy="88" rx="26" ry="5" className={`${styles.thin} ${styles.spreading}`} />
      <path d="M60 14c9 12.5 18 23.5 18 34.5a18 18 0 0 1-36 0C42 37.5 51 26.5 60 14Z" className={`${styles.line} ${styles.falling}`} />
    </svg>
  );
}

