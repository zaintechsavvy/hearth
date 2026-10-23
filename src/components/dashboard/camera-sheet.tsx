"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { glassSheetClass } from "@/components/glass/glass";
import styles from "./camera-sheet.module.css";

/** A camera opened from a tile linked to it, such as the garage door's: large, live, and closed with a tap outside. */
export function CameraSheet({ name, onClose, children }: { name: string | null; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open={name !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className={`${glassSheetClass} ${styles.sheet}`} title={name ?? ""}>
        <div className={styles.view}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
