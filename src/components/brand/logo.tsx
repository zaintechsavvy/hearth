import { MARK } from "@/lib/brand";
import styles from "./logo.module.css";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d={MARK.house} fill="none" className={styles.house} strokeWidth="2.1" strokeLinejoin="round" />
      <path d={MARK.flame} fill={MARK.flameColor} />
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
