import styles from "./logo.module.css";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M10 23v-6.5a6 6 0 0 1 12 0V23" fill="none" className={styles.door} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="18.2" r="1.9" className={styles.knob} />
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
