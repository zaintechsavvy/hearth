import styles from "./library.module.css";

export function ShelfSkeleton({ round }: { round?: boolean }) {
  return (
    <div className={styles.shelf} aria-hidden="true">
      {[0, 1, 2, 3, 4].map(index => (
        <span key={index} className={styles.shelfItem}>
          <span className={styles.skeletonCover} data-round={round || undefined} />
          <span className={styles.skeletonLine} />
        </span>
      ))}
    </div>
  );
}
