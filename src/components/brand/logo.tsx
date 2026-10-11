import styles from "./logo.module.css";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="hearth-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a4a" />
          <stop offset="1" stopColor="#4f8dff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hearth-mark)" />
      <path d="M10 23v-6.5a6 6 0 0 1 12 0V23" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="18" r="1.9" fill="#fff" />
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
