import { Check } from "lucide-react";
import styles from "./option-chips.module.css";

/** An integration's own name for a setting, such as `boost_mode`, as a person would write it. */
export const settingName = (value: string) => {
  const words = value.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

interface OptionChipsProps {
  label: string;
  value: string | null;
  options: string[];
  disabled?: boolean;
  /** The words for an option; the integration's own name, tidied, by default. */
  format?: (option: string) => string;
  /** The chosen option still waiting on the device, which shows a spinner in place of its tick. */
  busy?: string | null;
  onChoose: (option: string) => void;
}

/** A labelled row of choices, one of them current, for settings a device names itself, such as presets or suction. The current one is filled and ticked. */
export function OptionChips({ label, value, options, disabled, format = settingName, busy = null, onChoose }: OptionChipsProps) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div role="radiogroup" aria-label={label} className={styles.chips}>
        {options.map(option => (
          <button key={option} type="button" role="radio" aria-checked={option === value} aria-busy={(option === value && busy === option) || undefined} className={styles.chip} disabled={disabled} onClick={() => option !== value && onChoose(option)}>
            <span className={styles.check} aria-hidden="true">{option === value && busy === option ? <span className={styles.spinner} /> : <Check size={14} strokeWidth={2.25} />}</span>
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
