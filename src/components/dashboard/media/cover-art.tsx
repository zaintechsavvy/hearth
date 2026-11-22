"use client";

import { motion } from "motion/react";
import { Music } from "lucide-react";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import styles from "./media-tile.module.css";

/** `morph` carries the cover between the bar and the open player; only one cover on screen may have it. */
export function CoverArt({ device, morph = true, className }: { device: MediaPlayerDevice; morph?: boolean; className?: string }) {
  return (
    <motion.span layoutId={morph ? "art" : undefined} className={`${styles.art} ${className ?? ""}`} aria-hidden="true">
      <Music size={18} strokeWidth={1.75} />
      {device.artwork && <span className={styles.cover} style={{ backgroundImage: `url("${device.artwork}")` }} />}
    </motion.span>
  );
}
