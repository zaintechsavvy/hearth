import styles from "./media-tile.module.css";

/** Three bars that bounce while the item plays, and rest when it is paused or motion is reduced. */
export function PlayingBars({ paused }: { paused: boolean }) {
  return <span className={styles.bars} data-paused={paused || undefined} aria-hidden="true"><span /><span /><span /></span>;
}
