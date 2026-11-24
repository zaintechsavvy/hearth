"use client";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { useHome } from "@/components/dashboard/use-home";
import { RestPreview } from "@/components/shell/rest-preview";
import { CLOCK_COLORS, CLOCK_FACES, clockColorOf, dialColorOf, faceColorOf, type ClockColor, type WallSettings } from "@/lib/wall";
import styles from "./connections.module.css";

const HAND_COLORS: { label: string; value: string | null }[] = [
  { label: "The face's own", value: null }, { label: "White", value: "#f7f7f5" }, { label: "Black", value: "#1d1f24" },
  { label: "Gold", value: "#e2c27a" }, { label: "Rose gold", value: "#e8a98f" }, { label: "Red", value: "#e2503f" },
];
const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

/** Which face the screen rests on, each previewed as it will look on this screen, and the chosen face's own options. */
export function RestingScreenSettings({ settings, set }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void }) {
  const { home } = useHome();
  const sun = home?.sun ?? null;
  const face = settings.clockFace;
  const hands = face === "analog" || face === "luxury";
  const swatchOf = face === "luxury" ? dialColorOf : face === "analog" ? faceColorOf : clockColorOf;
  const ownHand = settings.handColor !== null && !HAND_COLORS.some(color => color.value === settings.handColor);

  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Resting screen</span>
        <span className={styles.rowMeta}>
          {!settings.frame ? "What this screen shows when no one is using it, exactly as it will look here."
            : settings.frameAtNight ? "Photos are on, so the screen rests on them with the time over them instead."
            : "Photos are on, so the screen rests on them by day, and on this face at night."}
        </span>
      </div>
      <RestPreview settings={settings} sun={sun} />
      <div role="radiogroup" aria-label="Clock face" className={styles.faces}>
        {CLOCK_FACES.map(({ value, label }) => (
          <button key={value} type="button" role="radio" aria-checked={face === value} className={styles.faceOption} onClick={() => set({ clockFace: value })}>
            <RestPreview settings={{ ...settings, clockFace: value }} sun={sun} className={styles.faceThumb} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <span className={styles.swatchLabel}>{face === "luxury" ? "Dial" : face === "analog" ? "Face" : "Colour"}</span>
      <div role="radiogroup" aria-label="Clock colour" className={styles.clockColors}>
        {(Object.keys(CLOCK_COLORS) as ClockColor[]).map(color => (
          <button key={color} type="button" role="radio" aria-checked={settings.clockColor === color} aria-label={titled(color)} title={titled(color)} className={styles.clockColor}
            style={{ background: swatchOf({ clockColor: color, customColor: settings.customColor }) }} onClick={() => set({ clockColor: color })} />
        ))}
        <label className={`${styles.clockColor} ${styles.customColor}`} data-checked={settings.clockColor === "custom" || undefined} title="Your own colour"
          style={settings.clockColor === "custom" ? { background: settings.customColor } : undefined}>
          <input type="color" className={styles.colorInput} aria-label="Your own colour" value={settings.customColor} onChange={event => set({ clockColor: "custom", customColor: event.target.value })} />
        </label>
      </div>
      {face === "digital" && (
        <>
          <SegmentedControl label="Digits" value={settings.digitLayout} onValueChange={value => set({ digitLayout: value as WallSettings["digitLayout"] })}
            options={[{ value: "inline", label: "Side by side" }, { value: "stacked", label: "Stacked" }]} />
          <Slider label="Size" value={Math.round(settings.digitScale * 100)} min={70} max={130} step={5} format={value => `${value}%`} onValueChange={value => set({ digitScale: value / 100 })} />
        </>
      )}
      {hands && (
        <>
          <span className={styles.swatchLabel}>Hands</span>
          <div role="radiogroup" aria-label="Hand colour" className={styles.clockColors}>
            {HAND_COLORS.map(({ label, value }) => (
              <button key={label} type="button" role="radio" aria-checked={settings.handColor === value} aria-label={label} title={label}
                className={`${styles.clockColor} ${value === null ? styles.autoColor : ""}`} style={value ? { background: value } : undefined} onClick={() => set({ handColor: value })} />
            ))}
            <label className={`${styles.clockColor} ${styles.customColor}`} data-checked={ownHand || undefined} title="Your own colour" style={ownHand ? { background: settings.handColor ?? undefined } : undefined}>
              <input type="color" className={styles.colorInput} aria-label="Your own hand colour" value={settings.handColor ?? "#ffffff"} onChange={event => set({ handColor: event.target.value })} />
            </label>
          </div>
          <SegmentedControl label="Seconds hand" value={settings.secondHand} onValueChange={value => set({ secondHand: value as WallSettings["secondHand"] })}
            options={[{ value: "tick", label: "Ticks" }, { value: "smooth", label: "Sweeps" }, { value: "off", label: "None" }]} />
        </>
      )}
      <Slider label="Brightness by day" value={Math.round(settings.clockBrightness * 100)} min={15} max={100} format={value => `${value}%`} onValueChange={value => set({ clockBrightness: value / 100 })} />
    </div>
  );
}
