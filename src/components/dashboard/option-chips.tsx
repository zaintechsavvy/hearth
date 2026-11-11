import styles from "./option-chips.module.css";

/** An integration's own name for a setting, such as `boost_mode`, as a person would write it. */
export const settingName = (value: string) => {
  const words = value.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A labelled row of choices, one of them current, for settings a device names itself, such as presets or suction. */
export function OptionChips({ label, value, options, disabled, onChoose }: { label: string; value: string | null; options: string[]; disabled?: boolean; onChoose: (option: string) => void }) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div role="radiogroup" aria-label={label} className={styles.chips}>
        {options.map(option => (
          <button key={option} type="button" role="radio" aria-checked={option === value} className={styles.chip} disabled={disabled} onClick={() => onChoose(option)}>
            {settingName(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
