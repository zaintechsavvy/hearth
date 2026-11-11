"use client";

import { Download, Tablet } from "lucide-react";
import { useSyncExternalStore, type CSSProperties } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { useHome } from "@/components/dashboard/use-home";
import { useMinute } from "@/components/dashboard/widgets/use-minute";
import { Glass } from "@/components/glass/glass";
import { installPrompt } from "@/components/shell/service-worker";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { CLOCK_COLORS, clockColorOf, DEFAULT_WALL, dialColorOf, faceColorOf, WALL_KEY, type ClockColor, type ClockFace, type WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";
import { PhotoFrameSettings } from "./photo-frame-settings";
import { AnalogFace } from "@/components/shell/analog-face";
import { LuxuryFace } from "@/components/shell/luxury-face";
import { startTour } from "@/components/shell/hearth-tour";
import { SettingsSection } from "./settings-section";

const WAKE_CLASSES = new Set(["motion", "occupancy", "door", "opening", "garage"]);
const HAND_COLORS: { label: string; value: string | null }[] = [
  { label: "The face's own", value: null }, { label: "White", value: "#f7f7f5" }, { label: "Black", value: "#1d1f24" },
  { label: "Gold", value: "#e2c27a" }, { label: "Rose gold", value: "#e8a98f" }, { label: "Red", value: "#e2503f" },
];
const titled = (word: string) => word[0].toUpperCase() + word.slice(1);
const standalone = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;

/** Turns this screen into a wall tablet. Settings stay on this device, so each tablet can behave differently. */
export function WallSection() {
  const [stored, setSettings] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  const settings = { ...DEFAULT_WALL, ...stored };
  const now = useMinute();
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
            <span className={styles.rowMeta}>Hides the menus, keeps the screen awake, dims at night, and rests on a clock. <button type="button" className={styles.ledeLink} onClick={startTour}>How it works</button></span>
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
          <div className={styles.inline}>
            <Input label="Dim from" type="time" value={settings.dimFrom} onChange={event => set({ dimFrom: event.target.value })} />
            <Input label="Until" type="time" value={settings.dimTo} onChange={event => set({ dimTo: event.target.value })} />
          </div>
          <Slider label="Night dimming" value={Math.round(settings.dimLevel * 100)} min={0} max={85} format={value => `${value}%`} onValueChange={value => set({ dimLevel: value / 100 })} />
          <Switch label="Keep the screen awake" checked={settings.keepAwake} onCheckedChange={keepAwake => set({ keepAwake })} />
          <Switch label="Show the assistant" checked={settings.showAssistant} onCheckedChange={showAssistant => set({ showAssistant })} />
        </div>
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Resting screen</span>
            <span className={styles.rowMeta}>The clock this screen rests on.</span>
          </div>
          <SegmentedControl label="Clock style" value={settings.clockFace} onValueChange={value => set({ clockFace: value as ClockFace })} options={[{ value: "digital", label: "Digital" }, { value: "analog", label: "Analog" }, { value: "luxury", label: "Luxury" }]} />
          {settings.clockFace === "digital" ? (
            <div className={styles.clockPreview} style={{ color: clockColorOf(settings), "--clock-brightness": settings.clockBrightness } as CSSProperties} aria-hidden="true">
              <span className={styles.clockPreviewDate}>{now ? new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "\u00a0"}</span>
              <span className={styles.clockPreviewTime}>{now ? new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "\u00a0"}</span>
            </div>
          ) : (
            <div className={`${styles.analogPreview} ${settings.clockFace === "luxury" ? styles.luxuryPreview : ""}`} style={{ "--saver-dim": settings.clockBrightness } as CSSProperties} aria-hidden="true">
              {settings.clockFace === "luxury" ? <LuxuryFace inline night={false} settings={settings} /> : <AnalogFace inline night={false} settings={settings} />}
            </div>
          )}
          <span className={styles.swatchLabel}>{settings.clockFace === "luxury" ? "Dial" : settings.clockFace === "analog" ? "Face" : "Colour"}</span>
          <div role="radiogroup" aria-label="Clock colour" className={styles.clockColors}>
            {(Object.keys(CLOCK_COLORS) as ClockColor[]).map(color => {
              const swatch = { clockColor: color, customColor: settings.customColor };
              return (
                <button key={color} type="button" role="radio" aria-checked={settings.clockColor === color} aria-label={titled(color)} title={titled(color)} className={styles.clockColor}
                  style={{ background: settings.clockFace === "luxury" ? dialColorOf(swatch) : settings.clockFace === "analog" ? faceColorOf(swatch) : clockColorOf(swatch) }} onClick={() => set({ clockColor: color })} />
              );
            })}
            <label className={`${styles.clockColor} ${styles.customColor}`} data-checked={settings.clockColor === "custom" || undefined} title="Your own colour"
              style={settings.clockColor === "custom" ? { background: settings.customColor } : undefined}>
              <input type="color" className={styles.colorInput} aria-label="Your own colour" value={settings.customColor} onChange={event => set({ clockColor: "custom", customColor: event.target.value })} />
            </label>
          </div>
          {settings.clockFace !== "digital" && (
            <>
              <span className={styles.swatchLabel}>Hands</span>
              <div role="radiogroup" aria-label="Hand colour" className={styles.clockColors}>
                {HAND_COLORS.map(({ label, value }) => (
                  <button key={label} type="button" role="radio" aria-checked={settings.handColor === value} aria-label={label} title={label}
                    className={`${styles.clockColor} ${value === null ? styles.autoColor : ""}`} style={value ? { background: value } : undefined} onClick={() => set({ handColor: value })} />
                ))}
                <label className={`${styles.clockColor} ${styles.customColor}`} data-checked={(settings.handColor !== null && !HAND_COLORS.some(color => color.value === settings.handColor)) || undefined} title="Your own colour"
                  style={settings.handColor && !HAND_COLORS.some(color => color.value === settings.handColor) ? { background: settings.handColor } : undefined}>
                  <input type="color" className={styles.colorInput} aria-label="Your own hand colour" value={settings.handColor ?? "#ffffff"} onChange={event => set({ handColor: event.target.value })} />
                </label>
              </div>
              <SegmentedControl label="Seconds hand" value={settings.secondHand} onValueChange={value => set({ secondHand: value as WallSettings["secondHand"] })}
                options={[{ value: "tick", label: "Ticks" }, { value: "smooth", label: "Sweeps" }, { value: "off", label: "None" }]} />
            </>
          )}
          <Slider label="Brightness" value={Math.round(settings.clockBrightness * 100)} min={15} max={100} format={value => `${value}%`} onValueChange={value => set({ clockBrightness: value / 100 })} />
          <Switch label="Dim red at night" checked={settings.nightRed} onCheckedChange={nightRed => set({ nightRed })} />
        </div>
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
