"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Device } from "@/lib/devices/types";
import { haptic } from "@/lib/haptics";
import { sentHere } from "@/lib/sent-here";
import styles from "./state-notice.module.css";

const SHOW_MS = 5000;
const OPENINGS = new Set(["door", "window", "garage", "opening"]);
const ENTRY_COVERS = new Set(["garage", "gate", "door"]);

type Picture = "garage" | "lock" | "door" | "leak";

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
    return { open: device.active, words: device.active ? "opened" : "closed", picture: device.sensorClass === "garage" ? "garage" : "door" };
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
            <span className={styles.art} aria-hidden="true">{notice.picture === "garage" ? <Garage /> : notice.picture === "lock" ? <Padlock /> : notice.picture === "leak" ? <Leak /> : <Door />}</span>
            <span className={styles.words}>
              <span className={styles.title}>{notice.alarm ? "Water leak" : `${notice.name} ${notice.words}`}</span>
              <span className={styles.meta}>{notice.alarm ? `${[notice.name, notice.room].filter(Boolean).join(" · ")}. Check it now, then tap to close.` : [notice.room, "just now"].filter(Boolean).join(" · ")}</span>
            </span>
          </motion.span>
          {!notice.alarm && <span className={styles.timer} aria-hidden="true" />}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** A garage front whose door slats roll up when it opens and down when it closes. */
function Garage() {
  return (
    <svg viewBox="0 0 120 100" className={styles.svg}>
      <path d="M10 42 L60 12 L110 42 V92 H10 Z" className={styles.house} />
      <clipPath id="garage-opening"><rect x="26" y="46" width="68" height="46" /></clipPath>
      <rect x="26" y="46" width="68" height="46" className={styles.inside} />
      <g clipPath="url(#garage-opening)">
        <g className={styles.rolling}>
          {[0, 1, 2, 3].map(index => <rect key={index} x="27" y={47 + index * 11.25} width="66" height="10" rx="1.5" className={styles.slat} />)}
        </g>
      </g>
    </svg>
  );
}

/** A padlock whose shackle lifts when it unlocks and drops when it locks. */
function Padlock() {
  return (
    <svg viewBox="0 0 120 100" className={styles.svg}>
      <path d="M44 48 V34 a16 16 0 0 1 32 0 V48" className={`${styles.shackle} ${styles.lifting}`} />
      <rect x="34" y="46" width="52" height="42" rx="9" className={styles.body} />
      <circle cx="60" cy="64" r="5" className={styles.keyhole} />
      <rect x="58" y="66" width="4" height="10" rx="2" className={styles.keyhole} />
    </svg>
  );
}

/** A drop of water, with rings spreading out from it while it is wet. */
function Leak() {
  return (
    <svg viewBox="0 0 120 100" className={styles.svg}>
      <ellipse cx="60" cy="86" rx="30" ry="6" className={styles.puddle} />
      <ellipse cx="60" cy="86" rx="30" ry="6" className={`${styles.puddle} ${styles.spreading}`} />
      <path d="M60 12c9 12.5 19 24 19 35.5a19 19 0 0 1-38 0C41 36 51 24.5 60 12Z" className={`${styles.body} ${styles.falling}`} />
    </svg>
  );
}

/** A door that swings open or shut in its frame. */
function Door() {
  return (
    <svg viewBox="0 0 120 100" className={styles.svg}>
      <rect x="36" y="10" width="48" height="82" rx="3" className={styles.frame} />
      <rect x="38" y="12" width="44" height="80" className={styles.inside} />
      <g className={styles.swinging}>
        <rect x="38" y="12" width="44" height="80" rx="2" className={styles.slat} />
        <circle cx="74" cy="54" r="3" className={styles.keyhole} />
      </g>
    </svg>
  );
}
