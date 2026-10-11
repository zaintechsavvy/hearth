"use client";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { Glass } from "@/components/glass/glass";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, DEFAULT_WALLPAPER, WALLPAPERS, WALLPAPER_KEY, type Accent, type ThemePreference, type Wallpaper } from "@/lib/theme";
import styles from "./connections.module.css";

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);
const WALLPAPER_NOTES: Record<Wallpaper, string> = { studio: "Neutral grey", linen: "Warm stone", slate: "Cool blue grey" };

export function AppearanceSection() {
  const [theme, setTheme] = useThemePreference();
  const [wallpaper, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [accent, setAccent] = useHtmlPreference<Accent>(ACCENT_KEY, "accent", DEFAULT_ACCENT);

  return (
    <section className={styles.section} aria-labelledby="appearance-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="appearance-title" className={styles.sectionTitle}>Appearance</h2>
          <p className={styles.sectionDescription}>Saved on this device.</p>
        </div>
      </div>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Theme</span>
          </div>
          <div className={styles.rowActions}>
            <SegmentedControl label="Theme" value={theme} onValueChange={value => setTheme(value as ThemePreference)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Wallpaper</span>
            <span className={styles.rowMeta}>The backdrop behind the glass.</span>
          </div>
          <div className={styles.rowActions} role="radiogroup" aria-label="Wallpaper">
            {WALLPAPERS.map(option => (
              <button key={option} type="button" role="radio" aria-checked={wallpaper === option} className={styles.wallpaperOption} onClick={() => setWallpaper(option)}>
                <span className={styles.wallpaperSwatch} data-preview={option} aria-hidden="true" />
                <span className={styles.wallpaperLabel}>{capitalize(option)}</span>
                <span className={styles.wallpaperNote}>{WALLPAPER_NOTES[option]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Accent</span>
            <span className={styles.rowMeta}>Switches, sliders, and selected controls.</span>
          </div>
          <div className={styles.rowActions}>
            <Select label="Accent" value={accent} onValueChange={value => setAccent(value as Accent)} options={ACCENTS.map(value => ({ value, label: capitalize(value) }))} />
          </div>
        </div>
      </Glass>
    </section>
  );
}
