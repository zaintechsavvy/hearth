"use client";

import type { CSSProperties } from "react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import { DEFAULT_WALLPAPER, isMesh, MESH_PALETTES, WALLPAPER_KEY, WALLPAPER_LABELS, WALLPAPERS, type ThemePreference, type Wallpaper } from "@/lib/theme";
import styles from "./background-picker.module.css";

function meshPreview(colors: string[]): CSSProperties {
  const [base, first, second, third] = colors;
  return {
    background: `radial-gradient(70% 70% at 15% 20%, ${first}, transparent 70%), radial-gradient(60% 60% at 85% 25%, ${third}, transparent 70%), radial-gradient(70% 70% at 70% 90%, ${second}, transparent 70%), ${base}`,
  };
}

/** Light, dark, or system, and the backdrop behind the glass. Saved on this device. */
export function BackgroundPicker({ showTheme = true }: { showTheme?: boolean }) {
  const [theme, setTheme] = useThemePreference();
  const resolved = useResolvedTheme();
  const [wallpaper, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  return (
    <div className={styles.picker}>
      {showTheme && (
        <SegmentedControl label="Theme" value={theme} onValueChange={value => setTheme(value as ThemePreference)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
      )}
      <div role="radiogroup" aria-label="Background" className={styles.options}>
        {WALLPAPERS.map(option => (
          <button key={option} type="button" role="radio" aria-checked={wallpaper === option} className={styles.option} onClick={() => setWallpaper(option)}>
            <span className={styles.swatch} data-preview={option} style={isMesh(option) ? meshPreview(MESH_PALETTES[option][resolved]) : undefined} aria-hidden="true" />
            <span className={styles.label}>{WALLPAPER_LABELS[option].name}</span>
            <span className={styles.note}>{WALLPAPER_LABELS[option].note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
