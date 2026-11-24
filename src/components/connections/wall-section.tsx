"use client";

import { Download, Tablet } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/arc/button/button";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { installPrompt } from "@/components/shell/service-worker";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { DEFAULT_WALL, WALL_KEY, type WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";
import { NightSettings } from "./night-settings";
import { PhotoFrameSettings } from "./photo-frame-settings";
import { ScreenWakeSettings } from "./screen-wake-settings";
import { RestingScreenSettings } from "./resting-screen-settings";
import Link from "next/link";
import { SettingsSection } from "./settings-section";

const WAKE_CLASSES = new Set(["motion", "occupancy", "door", "opening", "garage"]);
const standalone = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;

/** Turns this screen into a wall tablet. Settings stay on this device, so each tablet can behave differently. */
export function WallSection() {
  const [stored, setSettings] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  const settings = { ...DEFAULT_WALL, ...stored };
  const { home } = useHome();
  const canInstall = useSyncExternalStore(installPrompt.subscribe, () => Boolean(installPrompt.get()), () => false);
  const installed = useSyncExternalStore(() => () => {}, standalone, () => false);
  const set = (patch: Partial<WallSettings>) => setSettings({ ...settings, ...patch });
  const sensors = (home?.devices ?? []).filter(device => device.kind === "binary_sensor" && WAKE_CLASSES.has(device.sensorClass));

  return (
    <SettingsSection id="wall" title="Wall tablet" description={<>For a screen that stays on the wall.</>}>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <Tablet className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Use this screen as a wall tablet</span>
            <span className={styles.rowMeta}>Hides the menus, keeps the screen awake, dims at night, and rests on a clock. <Link href="/guide#wall" className={styles.ledeLink}>How it works</Link></span>
          </div>
          <div className={styles.rowActions}>
            <Switch aria-label="Use this screen as a wall tablet" checked={settings.enabled} onCheckedChange={enabled => {
              set({ enabled });
              if (enabled) void document.documentElement.requestFullscreen?.().catch(() => {});
            }} />
          </div>
        </div>
        <div className={`${styles.row} ${styles.stacked}`}>
          <Slider label="Rest after" value={settings.idleMinutes} min={0} max={30} format={value => value === 0 ? "Never" : `${value} min`} onValueChange={idleMinutes => set({ idleMinutes })} />
        </div>
        <ScreenWakeSettings settings={settings} set={set} />
        <RestingScreenSettings settings={settings} set={set} />
        <NightSettings settings={settings} set={set} />
        <PhotoFrameSettings settings={settings} set={set} />
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Left open after dark</span>
            <span className={styles.rowMeta}>A gentle note when a door, window, or garage door stays open once it is dark, with a way to close the garage.</span>
          </div>
          <Switch label="Remind me" checked={settings.openReminder} onCheckedChange={openReminder => set({ openReminder })} />
          <Slider label="After" value={settings.openMinutes} min={5} max={60} step={5} format={value => `${value} min`} onValueChange={openMinutes => set({ openMinutes })} />
        </div>
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Wake when someone walks by</span>
            <span className={styles.rowMeta}>{sensors.length ? "Pick motion, presence, or door sensors near this screen." : "Connect a motion or door sensor to wake the screen hands-free."}</span>
          </div>
          {sensors.map(sensor => (
            <Switch key={sensor.id} label={`${sensor.name}${sensor.room ? ` · ${sensor.room}` : ""}`} checked={settings.wakeSensors.includes(sensor.id)}
              onCheckedChange={on => set({ wakeSensors: on ? [...settings.wakeSensors, sensor.id] : settings.wakeSensors.filter(id => id !== sensor.id) })} />
          ))}
        </div>
        <div className={styles.row}>
          <Download className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Install Hearth</span>
            <span className={styles.rowMeta}>
              {installed ? "Installed. Hearth opens in its own window." : canInstall ? "Opens full screen, with its own icon." : "On iPad or iPhone: Share, then Add to Home Screen."}
            </span>
          </div>
          {canInstall && !installed && <div className={styles.rowActions}><Button variant="secondary" onClick={() => void installPrompt.show()}>Install</Button></div>}
        </div>
      </Glass>
    </SettingsSection>
  );
}
