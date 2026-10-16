"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRing, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass } from "@/components/glass/glass";
import type { Device, EventDevice } from "@/lib/devices/types";
import styles from "./doorbell-banner.module.css";

const SHOW_MS = 30_000;
const FRESH_MS = 60_000;

/** Announces a doorbell ring that arrives while the dashboard is open, and asks Hearth to keep a picture of it. Rings from before it opened stay quiet. */
export function DoorbellBanner({ devices }: { devices: Device[] }) {
  const reduce = useReducedMotion();
  const seen = useRef<Map<string, string | null> | null>(null);
  const [ring, setRing] = useState<EventDevice | null>(null);

  useEffect(() => {
    const doorbells = devices.filter((device): device is EventDevice => device.kind === "event" && device.eventClass === "doorbell");
    if (!seen.current) {
      seen.current = new Map(doorbells.map(device => [device.id, device.last]));
      return;
    }
    for (const doorbell of doorbells) {
      const previous = seen.current.get(doorbell.id);
      seen.current.set(doorbell.id, doorbell.last);
      if (doorbell.last && doorbell.last !== previous && Date.now() - Date.parse(doorbell.last) < FRESH_MS) {
        setRing(doorbell);
        void fetch("/api/doorbell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: doorbell.id, at: doorbell.last }) }).catch(() => {});
      }
    }
  }, [devices]);

  useEffect(() => {
    if (!ring) return;
    const timer = setTimeout(() => setRing(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [ring]);

  return (
    <AnimatePresence>
      {ring && (
        <motion.div
          key={ring.last}
          role="alert"
          className={`${glassClass("pill")} ${styles.banner}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: .98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit } }}
          transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
        >
          <span className={styles.icon} aria-hidden="true"><BellRing size={18} strokeWidth={1.75} /></span>
          <span className={styles.text}>Someone is at the door<span className={styles.where}>{ring.name}{ring.room ? ` · ${ring.room}` : ""}</span></span>
          <button type="button" className={styles.dismiss} onClick={() => setRing(null)} aria-label="Dismiss">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
