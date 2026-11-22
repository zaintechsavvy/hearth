"use client";

import { motion } from "motion/react";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import styles from "./media-tile.module.css";

export function TrackText({ device, id, morph = true, album = false }: { device: MediaPlayerDevice; id?: string; morph?: boolean; album?: boolean }) {
  const title = device.title ?? (device.state === "off" ? "Off" : "Nothing playing");
  const by = device.title ? device.artist : device.output ?? device.name;
  return (
    <motion.span layoutId={morph ? "text" : undefined} layout={morph ? "position" : undefined} className={styles.text}>
      <span id={id} className={styles.title}>{title}</span>
      {by && <span className={styles.by}>{by}{album && device.title && device.album && device.album !== by && <span className={styles.album}> · {device.album}</span>}</span>}
    </motion.span>
  );
}
