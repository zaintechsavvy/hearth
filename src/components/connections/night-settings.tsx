"use client";

import { Input } from "@/components/arc/input/input";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { useHome } from "@/components/dashboard/use-home";
import { RestPreview } from "@/components/shell/rest-preview";
import type { WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";

/** The night window: when it runs, how far the dashboard dims, and the red resting clock, previewed as it will look at night. */
export function NightSettings({ settings, set }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void }) {
  const { home } = useHome();
  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>At night</span>
        <span className={styles.rowMeta}>
          {settings.nightRed ? "The dashboard dims and the resting clock turns a dim red, so it lights the room as little as possible." : "The dashboard and the resting clock dim."}
        </span>
      </div>
      <div className={styles.times}>
        <Input label="From" type="time" value={settings.dimFrom} onChange={event => set({ dimFrom: event.target.value })} />
        <Input label="Until" type="time" value={settings.dimTo} onChange={event => set({ dimTo: event.target.value })} />
      </div>
      <RestPreview settings={settings} night sun={home?.sun ?? null} className={styles.nightPreview} />
      <Switch label="Red at night" checked={settings.nightRed} onCheckedChange={nightRed => set({ nightRed })} />
      {settings.nightRed && (
        <Slider label="Red brightness" value={Math.round(settings.redBrightness * 100)} min={5} max={60} format={value => `${value}%`} onValueChange={value => set({ redBrightness: value / 100 })} />
      )}
      <Slider label="Dim the dashboard" value={Math.round(settings.dimLevel * 100)} min={0} max={85} format={value => `${value}%`} onValueChange={value => set({ dimLevel: value / 100 })} />
    </div>
  );
}
