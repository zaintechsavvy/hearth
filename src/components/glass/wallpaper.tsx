import styles from "./wallpaper.module.css";

/** A quiet studio backdrop: an overhead light, a soft floor, and fine grain. Presets come from `data-wallpaper` on `<html>`. */
export function Wallpaper() {
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      <span className={styles.light} />
      <span className={styles.grain} />
    </div>
  );
}
