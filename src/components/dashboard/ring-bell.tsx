import styles from "./ring-bell.module.css";

/**
 * A brass doorbell bell drawn in SVG. While `ringing` it swings in 3D from its crown, the clapper striking against the
 * swing, with rings of sound spreading behind it; otherwise it hangs still. It fills the width it is given.
 */
export function RingBell({ ringing }: { ringing: boolean }) {
  return (
    <span className={styles.stage} data-ringing={ringing || undefined} aria-hidden="true">
      {ringing && <><span className={styles.wave} /><span className={styles.wave} /></>}
      <span className={styles.tilt}>
        <svg className={styles.bell} viewBox="0 0 200 220">
          <defs>
            <linearGradient id="ring-bell-body" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="oklch(52% .11 70)" />
              <stop offset=".28" stopColor="oklch(86% .13 88)" />
              <stop offset=".42" stopColor="oklch(97% .06 95)" />
              <stop offset=".62" stopColor="oklch(78% .14 80)" />
              <stop offset="1" stopColor="oklch(46% .1 62)" />
            </linearGradient>
            <linearGradient id="ring-bell-lip" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="oklch(44% .09 62)" />
              <stop offset=".4" stopColor="oklch(88% .12 88)" />
              <stop offset="1" stopColor="oklch(40% .08 58)" />
            </linearGradient>
            <radialGradient id="ring-bell-mouth" cx=".5" cy=".3" r=".7">
              <stop offset="0" stopColor="oklch(30% .06 60)" />
              <stop offset="1" stopColor="oklch(16% .03 55)" />
            </radialGradient>
          </defs>
          <g className={styles.swing}>
            <rect x="88" y="6" width="24" height="22" rx="10" fill="url(#ring-bell-lip)" />
            <ellipse cx="100" cy="176" rx="74" ry="16" fill="url(#ring-bell-mouth)" />
            <g className={styles.clapper}>
              <line x1="100" y1="120" x2="100" y2="182" stroke="oklch(40% .06 60)" strokeWidth="6" strokeLinecap="round" />
              <circle cx="100" cy="188" r="13" fill="url(#ring-bell-lip)" />
            </g>
            <path d="M100 24c-36 0-52 30-56 74-3 34-10 56-26 70 0 0 26 12 82 12s82-12 82-12c-16-14-23-36-26-70-4-44-20-74-56-74z" fill="url(#ring-bell-body)" />
            <path d="M18 168c0 0 26 12 82 12s82-12 82-12l4 9c0 0-28 14-86 14s-86-14-86-14z" fill="url(#ring-bell-lip)" />
            <path d="M72 46c-12 12-17 34-19 58" fill="none" stroke="oklch(100% 0 0 / .55)" strokeWidth="7" strokeLinecap="round" />
          </g>
        </svg>
      </span>
    </span>
  );
}
