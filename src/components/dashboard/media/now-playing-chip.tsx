"use client";

import { PlayingBars } from "./playing-bars";
import { openPlayer, useCanOpenPlayer } from "./player-requests";
import { useNowPlaying } from "./use-now-playing";
import styles from "./now-playing-chip.module.css";

/** What plays now, in the home's summary line. A tap opens the music tile's player. */
export function NowPlayingChip() {
  const now = useNowPlaying();
  const canOpen = useCanOpenPlayer();
  if (!now) return null;
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the music service as they are */}
      {now.artwork ? <img src={now.artwork} alt="" className={styles.art} referrerPolicy="no-referrer" /> : <PlayingBars paused={false} />}
      <span className={styles.text}>{now.artist ? `${now.title} – ${now.artist}` : now.title}</span>
    </>
  );
  return canOpen
    ? <button type="button" className={styles.chip} aria-label={`Now playing ${now.title}. Open the player`} onClick={() => openPlayer(now.device?.id)}>{body}</button>
    : <span className={styles.chip} aria-label={`Now playing ${now.title}`}>{body}</span>;
}
