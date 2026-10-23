"use client";

import { useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { glassSheetClass } from "@/components/glass/glass";
import { addCameraPage } from "@/lib/actions";
import { CAMERA_LAYOUTS, type CameraLayout } from "@/lib/dashboard/camera-pages";
import { spanOf } from "@/lib/dashboard/layout";
import styles from "./camera-page-dialog.module.css";

interface CameraPageDialogProps {
  open: boolean;
  cameras: number;
  /** An empty page to fill instead of making a new one. */
  into?: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the new page once it is saved. */
  onCreated: (pageId: string) => void;
}

/** A Cameras page in one step: each layout drawn small, and the home's cameras dropped into the one chosen. */
export function CameraPageDialog({ open, cameras, into, onOpenChange, onCreated }: CameraPageDialogProps) {
  const [pending, setPending] = useState<CameraLayout["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (layout: CameraLayout) => {
    setPending(layout.id);
    setError(null);
    const result = await addCameraPage(layout.id, into);
    setPending(null);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    onCreated(result.id);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={glassSheetClass} title="A page for your cameras" description={`Pick a layout. Your ${cameras === 1 ? "camera goes" : `${cameras} cameras go`} into it, and you can move them after.`}>
        <div className={styles.layouts}>
          {CAMERA_LAYOUTS.map(layout => (
            <button key={layout.id} type="button" className={styles.layout} onClick={() => void choose(layout)} disabled={pending !== null} aria-busy={pending === layout.id || undefined}>
              <span className={styles.preview} aria-hidden="true">
                {layout.slots.map((slot, index) => {
                  const { columns, rows } = spanOf(slot.size);
                  return <span key={index} className={styles.slot} data-filled={index < cameras || undefined} style={{ gridColumn: `${slot.at.column + 1} / span ${columns}`, gridRow: `${slot.at.row + 1} / span ${rows}` }} />;
                })}
              </span>
              <span className={styles.name}>{layout.name}</span>
            </button>
          ))}
        </div>
        <Alert tone="danger" title="Could not make the page" open={Boolean(error)}>{error ?? ""}</Alert>
      </DialogContent>
    </Dialog>
  );
}
