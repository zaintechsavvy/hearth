"use client";

import { Droplets } from "lucide-react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { BinarySensorDevice } from "@/lib/devices/types";
import styles from "./leak-tile.module.css";

/** A leak sensor at a glance: calm and dry most of the time, and impossible to miss the moment it gets wet. */
export function LeakTile({ device, config }: { device: BinarySensorDevice; config: TileConfig }) {
  const wet = device.available && device.active;
  const state = !device.available ? "Offline" : wet ? "Leak" : "Dry";
  const detail = !device.available ? "Not reporting" : wet ? "Water found. Check it now." : "No water found";
  const room = config.options?.hideRoom ? null : device.room;
  const label = `${device.name}${room ? ` in ${room}` : ""}, ${wet ? "leak detected" : state.toLowerCase()}`;
  if (config.size === "2x2") {
    return (
      <section className={`${glassClass("panel")} ${styles.tile} ${styles.large}`} data-wet={wet || undefined} data-offline={!device.available || undefined} role={wet ? "alert" : "group"} aria-label={label}>
        <Drop wet={wet} />
        <span className={styles.text}>
          <span className={styles.state}>{wet ? "Leak detected" : state}</span>
          <span className={styles.name}>{device.name}</span>
          <span className={styles.meta}>{[room, detail].filter(Boolean).join(" · ")}</span>
        </span>
      </section>
    );
  }
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={config.size} data-wet={wet || undefined} data-offline={!device.available || undefined} role={wet ? "alert" : "group"} aria-label={label}>
      <span className={styles.badge} aria-hidden="true"><Droplets size={config.size === "1x1" ? 24 : 20} strokeWidth={1.75} /></span>
      {config.size === "1x1" ? <span className={styles.name}>{wet ? "Leak" : device.name}</span> : (
        <span className={styles.text}>
          <span className={styles.name}>{device.name}</span>
          <span className={styles.meta}>{[wet ? "Leak detected" : state, room].filter(Boolean).join(" · ")}</span>
        </span>
      )}
    </section>
  );
}

/** A drop that sits still while dry and ripples while wet. */
function Drop({ wet }: { wet: boolean }) {
  return (
    <span className={styles.art} aria-hidden="true">
      {wet && <><span className={styles.ripple} /><span className={`${styles.ripple} ${styles.later}`} /></>}
      <svg viewBox="0 0 48 48" className={styles.drop}>
        <path d="M24 5c6 8.5 13 16.2 13 24a13 13 0 0 1-26 0c0-7.8 7-15.5 13-24Z" className={styles.dropShape} />
        <path d="M18 31a6.5 6.5 0 0 0 6 6" className={styles.shine} />
      </svg>
    </span>
  );
}
