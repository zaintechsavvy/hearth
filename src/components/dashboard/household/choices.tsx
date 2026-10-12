"use client";

import type { CSSProperties, ReactNode } from "react";
import { ColorPicker } from "@/components/arc/color-picker/color-picker";
import { glassClass } from "@/components/glass/glass";
import { TILE_ICON_COMPONENTS } from "../tiles/tile-icons";
import type { TileIcon } from "@/lib/dashboard/layout";
import styles from "./household.module.css";

export const HOUSEHOLD_COLORS = ["#22c55e", "#3b82f6", "#a16207", "#6b7280", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#111827"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/** Ten quick colours, plus Arc's picker for anything else. */
export function ColorChoice({ value, onChange, label = "Colour" }: { value: string; onChange: (hex: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <div className={styles.swatches} role="radiogroup" aria-label={label}>
        {HOUSEHOLD_COLORS.map(color => (
          <button key={color} type="button" role="radio" aria-checked={value.toLowerCase() === color} aria-label={color} className={styles.swatch} style={{ "--swatch": color } as CSSProperties} onClick={() => onChange(color)} />
        ))}
        <ColorPicker label="Custom" value={value} onValueChange={hex => onChange(hex.slice(0, 7))} defaultFormat="hex" />
      </div>
    </Field>
  );
}

/** One day, or several when `multiple`; with several, none chosen means every day. */
export function WeekdayChoice({ value, onChange, multiple = false, label = "Day" }: { value: number[]; onChange: (days: number[]) => void; multiple?: boolean; label?: string }) {
  return (
    <Field label={label}>
      <div className={styles.days} role={multiple ? "group" : "radiogroup"} aria-label={label}>
        {WEEKDAYS.map((day, index) => {
          const on = value.includes(index);
          return (
            <button key={day} type="button" className={styles.day} aria-label={day} title={day}
              {...(multiple ? { "aria-pressed": on } : { role: "radio", "aria-checked": on })}
              onClick={() => onChange(multiple ? (on ? value.filter(item => item !== index) : [...value, index].sort()) : [index])}>
              {day[0]}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function EmojiChoice({ value, onChange, options }: { value: string; onChange: (emoji: string) => void; options: string[] }) {
  return (
    <Field label="Emoji">
      <div className={styles.emojis} role="radiogroup" aria-label="Emoji">
        {options.map(emoji => (
          <button key={emoji} type="button" role="radio" aria-checked={value === emoji} className={styles.emoji} onClick={() => onChange(emoji)}>{emoji}</button>
        ))}
      </div>
    </Field>
  );
}

/** The friendly first state of a widget with nothing in it yet. */
export function SetupTile({ icon, title, hint, tone, onClick, wide = false, interactive = true }: { icon: TileIcon; title: string; hint: string; tone?: string; onClick: () => void; wide?: boolean; interactive?: boolean }) {
  const Icon = TILE_ICON_COMPONENTS[icon];
  return (
    <button type="button" className={`${glassClass("panel")} ${styles.setup}`} data-wide={wide || undefined} style={tone ? { "--tone": tone } as CSSProperties : undefined} onClick={onClick} disabled={!interactive}>
      <span className={styles.setupIcon} aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
      <span className={styles.setupText}>
        <span>{title}</span>
        <span className={styles.setupHint}>{hint}</span>
      </span>
    </button>
  );
}

export const weekdayName = (day: number) => WEEKDAYS[day];
