import { Music } from "lucide-react";
import Link from "next/link";
import styles from "./library.module.css";

/** The library before Spotify is signed in from Hearth: there is nothing to browse until it is. */
export function SpotifyPrompt() {
  return (
    <div className={styles.prompt}>
      <span className={styles.promptIcon}><Music size={26} strokeWidth={1.5} aria-hidden="true" /></span>
      <p className={styles.promptTitle}>Connect Spotify to see your music</p>
      <p className={styles.promptText}>Your playlists, albums, artists, and what you played lately show up here, ready to play on any speaker.</p>
      <Link href="/settings#spotify" className={styles.promptAction}>Connect in Settings</Link>
    </div>
  );
}
