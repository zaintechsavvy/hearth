"use client";

import { useEffect, useRef, useState } from "react";
import type { WallSettings } from "@/lib/wall";
import { RestFace } from "./rest-face";
import { useScreenSize } from "./use-screen-size";
import wall from "./wall-mode.module.css";
import styles from "./rest-preview.module.css";

/**
 * The resting screen exactly as this screen will show it: drawn at the screen's own size in CSS pixels, then scaled
 * down to fit, so every face lays itself out as it does full screen.
 */
export function RestPreview({ settings, night = false, sun = null, className }: {
  settings: WallSettings; night?: boolean; sun?: { sunrise: string; sunset: string } | null; className?: string;
}) {
  const screen = useScreenSize();
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} className={`${styles.preview} ${className ?? ""}`} style={{ aspectRatio: `${screen.width} / ${screen.height}` }} aria-hidden="true">
      <div className={styles.screen} style={{ width: screen.width, height: screen.height, transform: `scale(${width / screen.width})` }}>
        <span className={wall.saver} data-night={night || undefined} data-red={(night && settings.nightRed) || undefined}>
          <RestFace settings={settings} night={night} sun={sun} />
          <span className={wall.hint}>Touch to wake</span>
        </span>
      </div>
    </div>
  );
}
