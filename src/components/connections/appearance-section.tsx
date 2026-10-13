"use client";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { Glass } from "@/components/glass/glass";
import { BackgroundPicker } from "@/components/shell/background-picker";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, type Accent, type ThemePreference } from "@/lib/theme";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function AppearanceSection() {
  const [accent, setAccent] = useHtmlPreference<Accent>(ACCENT_KEY, "accent", DEFAULT_ACCENT);
  const [theme, setTheme] = useThemePreference();

  return (
    <SettingsSection id="appearance" title="Appearance" description={<>Theme, background, and accent.</>}>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Theme</span>
            <span className={styles.rowMeta}>System follows your device.</span>
          </div>
          <div className={styles.rowActions}>
            <SegmentedControl label="Theme" value={theme} onValueChange={value => setTheme(value as ThemePreference)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
          </div>
        </div>
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Background</span>
            <span className={styles.rowMeta}>Moving ones hold still when reduced motion is on.</span>
          </div>
          <BackgroundPicker showTheme={false} />
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
    </SettingsSection>
  );
}
