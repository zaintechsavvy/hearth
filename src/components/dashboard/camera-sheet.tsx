"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { glassSheetClass } from "@/components/glass/glass";
import styles from "./camera-sheet.module.css";

interface CameraSheetProps {
  name: string | null;
  onClose: () => void;
  children: ReactNode;
  /** Advanced mode: the controls of the things near the camera, as tiles in a row under the picture. */
  controls?: ReactNode[];
}

/** A camera opened large over the dashboard, live, with the controls near it underneath when it has any. */
export function CameraSheet({ name, onClose, children, controls = [] }: CameraSheetProps) {
  return (
    <Dialog open={name !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className={`${glassSheetClass} ${styles.sheet}`} data-stage={controls.length > 0 || undefined} title={name ?? ""}>
        <div className={styles.view}>{children}</div>
        {controls.length > 0 && (
          <ul className={styles.controls} aria-label="Nearby">
            {controls.map((control, index) => <li key={index} className={styles.control}>{control}</li>)}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
