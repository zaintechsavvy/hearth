"use client";

import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import type { WallSettings } from "@/lib/wall";
import { ClockFaceSettings } from "./clock-face-settings";
import styles from "./connections.module.css";

/** When the screen rests and on what: a dark screen, or a face previewed as it will look on this screen, with its own options. */
export function RestingScreenSettings({ settings, set }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void }) {
  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Resting screen</span>
        <span className={styles.rowMeta}>
          {settings.idleMinutes === 0 ? "The screen never rests on its own; rest it from the wall tablet menu."
            : settings.darkRest ? "Rests on a near-black screen. Moments and notices still play over it."
            : !settings.frame ? "What this screen shows when no one is using it, exactly as it will look here."
            : settings.frameAtNight ? "Photos are on, so the screen rests on them with the time over them instead."
            : "Photos are on, so the screen rests on them by day, and on this face at night."}
        </span>
      </div>
      <Slider label="Rest after" value={settings.idleMinutes} min={0} max={30} format={value => value === 0 ? "Never" : `${value} min`} onValueChange={idleMinutes => set({ idleMinutes })} />
      <Switch label="Rest on a dark screen instead of the clock" checked={settings.darkRest} onCheckedChange={darkRest => set({ darkRest })} />
      {!settings.darkRest && <ClockFaceSettings settings={settings} set={set} />}
    </div>
  );
}
