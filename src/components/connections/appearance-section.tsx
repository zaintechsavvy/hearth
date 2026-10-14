"use client";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { Glass } from "@/components/glass/glass";
import { BackgroundPicker } from "@/components/shell/background-picker";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import { X } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { NO_PAGE_RULES, PAGE_SCHEDULE_KEY, type PageRule } from "@/lib/page-schedule";
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, GLASS_KEY, type Accent, type GlassLevel, type ThemePreference } from "@/lib/theme";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function AppearanceSection({ pages }: { pages: { id: string; name: string }[] }) {
  const [accent, setAccent] = useHtmlPreference<Accent>(ACCENT_KEY, "accent", DEFAULT_ACCENT);
  const [theme, setTheme] = useThemePreference();
  const [glass, setGlass] = useHtmlPreference<GlassLevel>(GLASS_KEY, "glass", "frosted");

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
            <span className={styles.rowTitle}>Tiles</span>
            <span className={styles.rowMeta}>Clear lets more of the background through; solid is easiest to read.</span>
          </div>
          <div className={styles.rowActions}>
            <SegmentedControl label="Tiles" value={glass} onValueChange={value => setGlass(value as GlassLevel)} options={[{ value: "frosted", label: "Frosted" }, { value: "clear", label: "Clear" }, { value: "solid", label: "Solid" }]} />
          </div>
        </div>
        <PageTimes pages={pages} />
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

/** Pages this screen shows by time of day. A window starts its page and hands back to the first page when it ends. */
function PageTimes({ pages }: { pages: { id: string; name: string }[] }) {
  const [rules, setRules] = useStoredJson<PageRule[]>(PAGE_SCHEDULE_KEY, NO_PAGE_RULES);
  const update = (id: string, patch: Partial<PageRule>) => setRules(rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  const options = pages.map(page => ({ value: page.id, label: page.name }));
  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Pages by time of day</span>
        <span className={styles.rowMeta}>{pages.length > 1 ? "This screen switches to a page while its time lasts, then back to the first page." : "Add a second dashboard page, such as Night, to switch pages by time."}</span>
      </div>
      {pages.length > 1 && (
        <>
          {rules.map(rule => (
            <div key={rule.id} className={styles.pageTime}>
              <Select label="Page" value={rule.pageId} onValueChange={pageId => update(rule.id, { pageId })} options={options} />
              <Input label="From" type="time" value={rule.from} onChange={event => update(rule.id, { from: event.target.value || rule.from })} />
              <Input label="Until" type="time" value={rule.to} onChange={event => update(rule.id, { to: event.target.value || rule.to })} />
              <Button variant="ghost" size="sm" className={styles.pageTimeRemove} aria-label="Remove this time" onClick={() => setRules(rules.filter(item => item.id !== rule.id))}><X size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className={styles.alignEnd} onClick={() => setRules([...rules, { id: crypto.randomUUID(), pageId: pages[pages.length - 1].id, from: "22:00", to: "07:00" }])}>Add a time</Button>
        </>
      )}
    </div>
  );
}
