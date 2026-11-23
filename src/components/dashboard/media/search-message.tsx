import { RotateCw, SearchX } from "lucide-react";
import styles from "./library.module.css";

/** Nothing found, or search failing, with a way to try again. */
export function SearchMessage({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className={styles.message} role={onRetry ? "alert" : "status"}>
      <SearchX size={26} strokeWidth={1.5} aria-hidden="true" />
      <p className={styles.promptTitle}>{title}</p>
      <p className={styles.promptText}>{text}</p>
      {onRetry && <button type="button" className={styles.inlineAction} onClick={onRetry}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> Try again</button>}
    </div>
  );
}
