"use client";

import { useState } from "react";
import useSWR, { mutate as revalidate } from "swr";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import type { QueuedTrack } from "@/lib/spotify/playback";
import { fetchJson } from "./media-hooks";
import { MediaRow } from "./media-row";
import { QUEUE_KEY } from "./use-live-player";
import { PLAYBACK_KEY } from "./use-now-playing";
import styles from "./media-tile.module.css";

const track = (song: QueuedTrack): MediaItem => ({ title: song.title, subtitle: song.artist, kind: "track", media: { id: song.uri, type: "music" }, artwork: song.artwork, playable: true, expandable: false, duration: song.duration });

/** What plays now and Spotify's own queue after it. A tap on a queued song skips ahead to it. */
export function SpotifyQueue({ device, disabled }: { device: MediaPlayerDevice; disabled: boolean }) {
  const { data, mutate } = useSWR<{ tracks?: QueuedTrack[]; reconnect?: true }>(QUEUE_KEY, fetchJson, { refreshInterval: 6000, keepPreviousData: true });
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const now: MediaItem | null = device.title ? { title: device.title, subtitle: device.artist, kind: "track", media: device.media ?? { id: "", type: "music" }, artwork: device.artwork, playable: false, expandable: false } : null;

  const skip = async (index: number) => {
    setError(null);
    setSkipping(true);
    try {
      const response = await fetch("/api/spotify/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "skip", count: index + 1 }) });
      if (!response.ok) throw new Error();
      await mutate(current => current?.tracks ? { tracks: current.tracks.slice(index + 1) } : current, { revalidate: false });
    } catch {
      setError("Spotify did not skip just now. Try again in a moment.");
    } finally {
      setSkipping(false);
      void revalidate(PLAYBACK_KEY);
      setTimeout(() => void mutate(), 800);
    }
  };

  return (
    <>
      {now && (
        <>
          <span className={styles.groupLabel}>Now playing</span>
          <div className={styles.rows}><MediaRow item={now} playing paused={device.state !== "playing"} onOpen={() => {}} onPlay={() => {}} /></div>
        </>
      )}
      <span className={styles.groupLabel}>Next from Spotify</span>
      {error && <p className={styles.callout} role="alert">{error}</p>}
      <div className={styles.rows}>
        {data === undefined ? <p className={styles.note}>Asking Spotify what plays next…</p>
          : data.reconnect ? <p className={styles.note}>Connect Spotify again in Settings to see what plays next.</p>
          : !data.tracks?.length ? <p className={styles.note}>Nothing is queued after this.</p>
          : data.tracks.map((song, index) => <MediaRow key={`${index}:${song.uri}`} item={track(song)} disabled={disabled || skipping} onOpen={() => {}} onPlay={() => void skip(index)} />)}
      </div>
    </>
  );
}
