"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import styles from "./hanging-bulb.module.css";

/**
 * A light bulb hanging on its cord. Turning it on drops it in on a little swing and it flickers to life; turning it
 * off makes it flicker out and sway to a stop. `tint` colours the glow for a coloured light.
 */
export function HangingBulb({ on, size, tint }: { on: boolean; size: number; tint?: string | null }) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const id = useId();
  const was = useRef(on);

  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    if (reduce) return;
    const swing = on ? [0, -14, 10, -6, 3, 0] : [0, 9, -6, 3, 0];
    void animate("[data-part=hang]", { rotate: swing, y: on ? [-6, 2, 0, 0, 0, 0] : 0 }, { duration: on ? 1.1 : 0.9, ease: "easeOut" });
    void animate("[data-part=glow]", { opacity: on ? [0, .9, .15, 1, .55, 1] : [1, .25, .8, .1, 0] }, { duration: on ? 0.7 : 0.55, ease: "linear" });
  }, [on, reduce, animate]);

  return (
    <span ref={scope} className={styles.bulb} data-on={on || undefined} style={{ width: size, height: size, ...(tint ? { "--bulb": tint } : {}) } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} overflow="visible">
        <defs>
          <radialGradient id={`${id}-glass`} cx="40%" cy="35%" r="65%">
            <stop offset="0" className={styles.glassHi} />
            <stop offset="1" className={styles.glassLo} />
          </radialGradient>
          <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0" className={styles.haloIn} />
            <stop offset="1" className={styles.haloOut} />
          </radialGradient>
        </defs>
        <motion.g data-part="hang" style={{ originX: "24px", originY: "-6px" }}>
          <line x1="24" y1="-6" x2="24" y2="10" className={styles.cord} />
          <rect x="20" y="10" width="8" height="7" rx="1.5" className={styles.base} />
          <line x1="20.5" y1="12.5" x2="27.5" y2="12.5" className={styles.thread} />
          <line x1="20.5" y1="15" x2="27.5" y2="15" className={styles.thread} />
          <motion.circle data-part="glow" cx="24" cy="29" r="20" fill={`url(#${id}-halo)`} initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0 }} />
          <path d="M 20 17 C 20 20 13 23 13 30 A 11 11 0 0 0 35 30 C 35 23 28 20 28 17 Z" fill={`url(#${id}-glass)`} className={styles.glass} />
          <path d="M 22 18 L 22.2 27.5 M 26 18 L 25.8 27.5" className={styles.wire} />
          <motion.path data-part="glow" d="M 22.2 27.5 q .45 -1.4 .9 0 q .45 1.4 .9 0 q .45 -1.4 .9 0 q .45 1.4 .9 0" className={styles.filament} initial={false} animate={{ opacity: on ? 1 : 0.35 }} transition={{ duration: 0 }} />
          <ellipse cx="19.5" cy="26" rx="2" ry="4" className={styles.shine} transform="rotate(20 19.5 26)" />
        </motion.g>
      </svg>
    </span>
  );
}
