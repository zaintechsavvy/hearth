import styles from "./library.module.css";
import tile from "./media-tile.module.css";

export function SearchSkeleton() {
  return (
    <div className={styles.topGrid} role="status" aria-label="Searching">
      <span className={styles.skeletonTop} />
      <div className={tile.rows}>{[0, 1, 2, 3].map(index => <span key={index} className={tile.skeletonRow} />)}</div>
    </div>
  );
}
