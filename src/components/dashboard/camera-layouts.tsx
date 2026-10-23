"use client";

import { CAMERA_LAYOUTS, type CameraLayout } from "@/lib/dashboard/camera-pages";
import { spanOf } from "@/lib/dashboard/layout";
import styles from "./camera-layouts.module.css";

/** The camera layouts, each drawn small with as many slots filled as there are cameras to place. */
export function CameraLayouts({ cameras, onChoose }: { cameras: number; onChoose: (layout: CameraLayout) => void }) {
  return (
    <div className={styles.layouts}>
      {CAMERA_LAYOUTS.map(layout => (
        <button key={layout.id} type="button" className={styles.layout} onClick={() => onChoose(layout)}>
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
  );
}
