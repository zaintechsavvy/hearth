"use client";

import { Check } from "lucide-react";
import type { Start } from "./use-spotify-start";
import styles from "./media-tile.module.css";

/**
 * How starting Spotify on a speaker is going: a bar that fills while it wakes, a calm ask to start a Google speaker by
 * voice while Hearth listens for it, then the outcome.
 */
export function WakeStatus({ start, onCancel }: { start: Start; onCancel: () => void }) {
  if (start.phase === "failed") return <p className={styles.callout} role="alert">{start.error}</p>;
  if (start.phase === "done") return <p className={styles.wakeDone} role="status"><Check size={16} strokeWidth={2} aria-hidden="true" />Playing on {start.name}</p>;
  if (start.phase === "listening") {
    return (
      <div className={styles.listen} role="status">
        <span className={styles.listenDot} aria-hidden="true" />
        <span className={styles.listenText}>
          {start.note && <span className={styles.listenNote}>{start.note}</span>}
          <span>Say &ldquo;Hey Google, play Spotify&rdquo; to {start.name}</span>
          <span className={styles.listenNote}>Hearth plays your pick there as soon as it hears from it.</span>
        </span>
        <button type="button" className={styles.listenCancel} onClick={onCancel}>Cancel</button>
      </div>
    );
  }
  return (
    <div className={styles.wake} role="status">
      <span>Starting Spotify on {start.name}…</span>
      <span className={styles.wakeTrack} aria-hidden="true"><span className={styles.wakeFill} /></span>
    </div>
  );
}
