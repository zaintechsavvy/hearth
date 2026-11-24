"use client";

import { useNowPlaying } from "@/components/dashboard/media/use-now-playing";
import styles from "./rest-now-playing.module.css";

/** On the resting screen, a small note of what plays now, so music left on is easy to notice. */
export function RestNowPlaying() {
  const now = useNowPlaying();
  if (!now) return null;
  return (
    <span className={styles.playing} role="status" aria-label={`Now playing ${now.title}`}>
      <span className={styles.bars} aria-hidden="true"><span /><span /><span /></span>
      {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the music service as they are */}
      {now.artwork && <img src={now.artwork} alt="" className={styles.art} referrerPolicy="no-referrer" />}
      <span className={styles.text}>
        <span className={styles.title}>{now.title}</span>
        {now.artist && <span className={styles.artist}>{now.artist}</span>}
      </span>
    </span>
  );
}
