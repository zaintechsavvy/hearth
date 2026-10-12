"use client";

import { Maximize2, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { glassClass } from "@/components/glass/glass";
import type { CameraDevice } from "@/lib/devices/types";
import styles from "./camera-tile.module.css";

const SNAPSHOT_MS = 3000;

/**
 * A camera an integration relays, such as any Home Assistant camera. Plays the MJPEG stream through Hearth's
 * server, falls back to refreshing snapshots, and says so plainly when the integration cannot relay video.
 */
export function IntegrationCameraTile({ camera }: { camera: CameraDevice }) {
  const frame = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<"stream" | "snapshot" | "offline">(camera.streamable ? "stream" : "offline");
  const [tick, setTick] = useState(0);
  const base = `/api/devices/${encodeURIComponent(camera.id)}/camera`;

  useEffect(() => {
    if (mode !== "snapshot") return;
    const timer = setInterval(() => setTick(value => value + 1), SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [mode]);

  const state = mode === "stream" ? "live" : mode;
  return (
    <figure ref={frame} className={`${glassClass()} ${styles.tile} ${styles.fill}`} data-state={state}>
      {mode !== "offline" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live MJPEG stream that must bypass the image optimiser
        <img
          className={styles.media}
          src={mode === "stream" ? base : `${base}?mode=snapshot&frame=${tick}`}
          alt={`${mode === "stream" ? "Live view" : "Latest frame"} from ${camera.name}`}
          onError={() => setMode(current => current === "stream" ? "snapshot" : "offline")}
        />
      )}
      {mode === "offline" && (
        <div className={styles.offline}>
          <VideoOff size={24} strokeWidth={1.75} aria-hidden="true" />
          <p>{camera.streamable ? "Cannot reach this camera" : "This camera is visible over Matter, but its video is not. Add it through Home Assistant or as an RTSP camera to watch it here."}</p>
        </div>
      )}
      <figcaption className={`${glassClass("pill")} ${styles.caption}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>{camera.name}</span>
        <span className={styles.badge}>{mode === "stream" ? "Live" : mode === "snapshot" ? "Snapshot" : "No video"}</span>
      </figcaption>
      {mode !== "offline" && (
        <button type="button" className={`${glassClass("pill")} ${styles.fullscreen}`} onClick={() => frame.current?.requestFullscreen?.()} aria-label={`Show ${camera.name} full screen`}>
          <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </figure>
  );
}
