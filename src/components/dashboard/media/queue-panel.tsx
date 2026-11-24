"use client";

import useSWR from "swr";
import { useHome } from "@/components/dashboard/use-home";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { itemsOf } from "@/lib/widgets/items";
import { fetchJson, type Send, type Track } from "./media-hooks";
import { SpotifyQueue } from "./spotify-queue";
import { TrackRow } from "./track-row";
import { ViewHead } from "./view-head";
import styles from "./media-tile.module.css";

/**
 * Up next: Spotify's own queue while Spotify plays here, otherwise the player's next and recently played songs; then
 * favourites, saved in Hearth. Any of them with a known source plays again on tap.
 */
export function QueuePanel({ device, send, disabled, spotify, onBack }: { device: MediaPlayerDevice; send: Send; disabled: boolean; spotify: boolean; onBack?: () => void }) {
  const { home, removeItem } = useHome();
  const { data } = useSWR<{ recent: Track[]; next: Track | null }>(spotify ? null : `/api/devices/${encodeURIComponent(device.id)}/media?title=${encodeURIComponent(device.title ?? "")}&queue=${device.can.queue ? 1 : 0}`, fetchJson, { refreshInterval: 30_000 });
  const favourites = itemsOf(home?.widgets ?? [], "favorite");
  const playable = (track: Track) => Boolean(track.media && device.can.play && !disabled);
  const play = (track: Track) => { if (track.media) void send({ type: "playMedia", id: track.media.id, mediaType: track.media.type }); };
  return (
    <div className={styles.list}>
      <ViewHead title="Up next" onBack={onBack} />
      {spotify ? <SpotifyQueue device={device} disabled={disabled} /> : (
        <>
          {data?.next && <div className={styles.rows}><TrackRow track={data.next} /></div>}
          <span className={styles.groupLabel}>Recently played</span>
          <div className={styles.rows}>
            {data === undefined ? <p className={styles.note}>Looking back through today…</p>
              : data.recent.length === 0 ? <p className={styles.note}>Nothing else has played today.</p>
              : data.recent.map(track => <TrackRow key={track.title} track={track} onPlay={playable(track) ? () => play(track) : undefined} />)}
          </div>
        </>
      )}
      <span className={styles.groupLabel}>Favourites</span>
      <div className={styles.rows}>
        {favourites.length === 0 ? <p className={styles.note}>Tap the heart while something plays to keep it here.</p>
          : favourites.map(item => {
            const track = { title: item.data.title, artist: item.data.artist || null, media: { id: item.data.contentId, type: item.data.contentType } };
            return <TrackRow key={item.id} track={track} onPlay={playable(track) ? () => play(track) : undefined} onRemove={disabled ? undefined : () => void removeItem(item.id)} />;
          })}
      </div>
    </div>
  );
}
