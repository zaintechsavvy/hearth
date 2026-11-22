import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./media-tile.module.css";

export function ViewHead({ title, onBack, backLabel = "Back to the controls", children }: { title: string; onBack?: () => void; backLabel?: string; children?: ReactNode }) {
  return (
    <div className={styles.viewHead}>
      {onBack && <button type="button" className={styles.back} aria-label={backLabel} onClick={onBack}><ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" /></button>}
      <h3 className={styles.viewTitle}>{title}</h3>
      {children}
    </div>
  );
}
