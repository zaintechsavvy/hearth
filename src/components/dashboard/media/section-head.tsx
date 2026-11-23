import { ChevronRight } from "lucide-react";
import styles from "./library.module.css";

/** A section's name, with a way to see all of it when there is more. */
export function SectionHead({ title, more, onMore }: { title: string; more?: string; onMore?: () => void }) {
  return (
    <div className={styles.sectionHead}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {onMore && (
        <button type="button" className={styles.sectionMore} onClick={onMore}>
          {more ?? "See all"} <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
