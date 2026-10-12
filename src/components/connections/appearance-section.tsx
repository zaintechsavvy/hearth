"use client";

import { Select } from "@/components/arc/select/select";
import { Glass } from "@/components/glass/glass";
import { BackgroundPicker } from "@/components/shell/background-picker";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, type Accent } from "@/lib/theme";
import styles from "./connections.module.css";

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function AppearanceSection() {
  const [accent, setAccent] = useHtmlPreference<Accent>(ACCENT_KEY, "accent", DEFAULT_ACCENT);

  return (
    <section id="appearance" className={styles.section} aria-labelledby="appearance-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="appearance-title" className={styles.sectionTitle}>Appearance</h2>
          <p className={styles.sectionDescription}>Saved on this device. The dashboard has the same picker under Background.</p>
        </div>
      </div>
      <Glass shape="panel" className={styles.group}>
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Theme and background</span>
            <span className={styles.rowMeta}>Moving backgrounds use Paper Shaders and hold still when reduced motion is on.</span>
          </div>
          <BackgroundPicker />
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
