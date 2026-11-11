"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import styles from "./desk-lamp.module.css";

/**
 * A table lamp with a pull string. Switching it gives the string a short tug, then the light under the shade fades
 * on or off, quietly. `tint` colours the light for a coloured lamp; `size` is pixels, or any length for a frame.
 */
export function DeskLamp({ on, size, tint }: { on: boolean; size: number | string; tint?: string | null }) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const id = useId();
  const was = useRef(on);

  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    if (reduce) return;
    void animate("[data-part=pull]", { y: [0, 3.2, 0] }, { duration: .42, ease: "easeInOut" });
    void animate("[data-part=light]", { opacity: on ? [0, 0, 1] : [1, 1, 0] }, { duration: .9, times: [0, .35, 1], ease: "easeOut" });
  }, [on, reduce, animate]);

  const dimension = typeof size === "number" ? size : "100%";
  return (
    <span ref={scope} className={styles.lamp} data-on={on || undefined} style={{ width: size, height: size, ...(tint ? { "--lamp": tint } : {}) } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={dimension} height={dimension} overflow="visible">
        <defs>
          <linearGradient id={`${id}-shade`} x1="0" x2="1">
            <stop offset="0" className={styles.shadeDark} />
            <stop offset=".45" className={styles.shadeLight} />
            <stop offset="1" className={styles.shadeDark} />
          </linearGradient>
          <radialGradient id={`${id}-pool`} cx="50%" cy="0%" r="100%">
            <stop offset="0" className={styles.poolIn} />
            <stop offset="1" className={styles.poolOut} />
          </radialGradient>
        </defs>
        <motion.g data-part="light" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0 }}>
          <path d="M 12 23 L 36 23 L 44 45 L 4 45 Z" fill={`url(#${id}-pool)`} />
        </motion.g>
        <ellipse cx="24" cy="44.5" rx="9" ry="2" className={styles.base} />
        <rect x="23" y="23" width="2" height="21" rx="1" className={styles.stem} />
        <path d="M 17 9 L 31 9 L 36 23 L 12 23 Z" fill={`url(#${id}-shade)`} className={styles.shade} />
        <ellipse cx="24" cy="9" rx="7" ry="1.4" className={styles.rim} />
        <motion.ellipse data-part="light" cx="24" cy="23" rx="12" ry="2.2" className={styles.glow} initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0 }} />
        <ellipse cx="24" cy="23" rx="12" ry="2.2" className={styles.rimLow} />
        <motion.g data-part="pull">
          <line x1="32.5" y1="23" x2="32.5" y2="30" className={styles.string} />
          <circle cx="32.5" cy="30.8" r="1.1" className={styles.bead} />
        </motion.g>
      </svg>
    </span>
  );
}
