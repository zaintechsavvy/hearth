import styles from "./wallpaper.module.css";

/** The colour field the glass refracts. Fixed behind every page. */
export function Wallpaper() {
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      <span className={styles.peach} />
      <span className={styles.sky} />
      <span className={styles.lilac} />
      <span className={styles.grain} />
    </div>
  );
}
