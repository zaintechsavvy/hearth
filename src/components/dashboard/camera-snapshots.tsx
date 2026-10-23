"use client";

import { Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { glassClass } from "@/components/glass/glass";
import styles from "./camera-tile.module.css";

/** How long a tap on a snapshot camera plays live before it settles back to stills. */
const LIVE_FOR_MS = 120_000;

interface SnapshotCameraProps {
  name: string;
  /** The still to show; `frame` changes each refresh so the browser asks again. */
  still: (frame: number) => string;
  /** Seconds between stills. */
  every: number;
  /** The live view, shown for a while after a tap. */
  live: ReactNode;
  fill?: boolean;
}

const everyWords = (seconds: number) => seconds < 60 ? `Every ${seconds} s` : `Every ${Math.round(seconds / 60)} min`;

/**
 * A camera that shows a fresh still every so often instead of streaming, for a screen that is on all day: no video
 * is pulled until someone taps, which plays it live for two minutes.
 */
export function SnapshotCamera({ name, still, every, live, fill = true }: SnapshotCameraProps) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (playing) return;
    const timer = setInterval(() => setFrame(value => value + 1), every * 1000);
    return () => clearInterval(timer);
  }, [every, playing]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), LIVE_FOR_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  if (playing) return <>{live}</>;
  return (
    <figure className={`${glassClass()} ${styles.tile} ${fill ? styles.fill : ""}`} data-state="snapshot">
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element -- an authenticated, refreshing JPEG that must bypass the image optimiser
        <img className={styles.media} src={still(frame)} alt={`Latest picture from ${name}`} onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
      )}
      <button type="button" className={styles.playLive} onClick={() => setPlaying(true)} aria-label={`Watch ${name} live for two minutes`}>
        <span className={`${glassClass("pill")} ${styles.playBadge}`}><Play size={14} strokeWidth={2} aria-hidden="true" /> Live</span>
      </button>
      <figcaption className={`${glassClass("pill")} ${styles.caption}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
        <span className={styles.badge}>{failed ? "No picture" : everyWords(every)}</span>
      </figcaption>
    </figure>
  );
}
