import { MARK } from "@/lib/brand";
import styles from "./logo.module.css";

/** The house outline alone, in the colour of the text around it, so it is dark on light backgrounds and light on dark ones. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox={MARK.bounds} aria-hidden="true">
      <path d={MARK.house} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.word}>Hearth</span>
    </span>
  );
}
