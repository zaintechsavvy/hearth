"use client";

import Link from "next/link";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { keepAwakeOf, type KeepAwake, type WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";

const MEANING: Record<KeepAwake, string> = {
  always: "The screen never turns off on its own while Hearth is open.",
  "in-use": "Stays on while someone uses it and after the doorbell, a wake sensor, or a door, garage, lock, or alarm change, then lets the tablet's Auto-Lock turn it off. Set Auto-Lock to its shortest, since it counts on top.",
  never: "The tablet's own Auto-Lock decides when the screen turns off.",
};

/** How long the wall tablet keeps its display on. */
export function ScreenWakeSettings({ settings, set }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void }) {
  const mode = keepAwakeOf(settings.keepAwake);
  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Keep the screen awake</span>
        <span className={styles.rowMeta}>{MEANING[mode]} Once it is off, only a touch or the button turns it back on. <Link href="/guide#screen" className={styles.ledeLink}>Waking on events</Link></span>
      </div>
      <SegmentedControl label="Keep the screen awake" value={mode} onValueChange={value => set({ keepAwake: value as KeepAwake })}
        options={[{ value: "always", label: "Always" }, { value: "in-use", label: "While in use" }, { value: "never", label: "Never" }]} />
      {mode === "in-use" && (
        <Slider label="Stay awake for" value={settings.awakeMinutes} min={1} max={30} format={value => `${value} min`} onValueChange={awakeMinutes => set({ awakeMinutes })} />
      )}
    </div>
  );
}
