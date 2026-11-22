"use client";

import { motion } from "motion/react";
import { clamp } from "@/lib/devices/types";
import styles from "./media-tile.module.css";

export function ProgressRail({ position, duration, morph = true }: { position: number | null; duration: number | null; morph?: boolean }) {
  if (position === null || !duration) return null;
  return (
    <motion.span layoutId={morph ? "rail" : undefined} className={styles.rail} aria-hidden="true">
      <span className={styles.run} style={{ width: `${clamp(position / duration, 0, 1) * 100}%` }} />
    </motion.span>
  );
}
