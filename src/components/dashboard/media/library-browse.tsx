"use client";

import { Disc3, ListMusic, Play, Shuffle, User } from "lucide-react";
import useSWR from "swr";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { fetchJson } from "./media-hooks";
import { MediaItems } from "./media-items";
import { SectionHead } from "./section-head";
import styles from "./media-tile.module.css";

const KIND_LABEL: Partial<Record<MediaItem["kind"], string>> = { album: "Album", playlist: "Playlist", artist: "Artist" };
const HERO_ICONS = { track: Disc3, album: Disc3, artist: User, playlist: ListMusic, other: ListMusic };

/** One level of the Spotify library: the top when `item` is null, or what is inside an album, playlist, artist, or folder. */
export function LibraryBrowse({ item, device, disabled, onOpen, onPlay }: {
  item: MediaItem | null; device: MediaPlayerDevice; disabled: boolean;
  onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem, shuffle?: boolean) => void;
}) {
  const query = item ? `?id=${encodeURIComponent(item.media.id)}&type=${encodeURIComponent(item.media.type)}` : "";
  const { data, error } = useSWR<{ title: string; items: MediaItem[]; note?: string }>(`/api/spotify/browse${query}`, fetchJson, { revalidateOnFocus: false });
  const hero = item && (item.playable || item.artwork) && item.kind !== "other";
  const HeroIcon = item ? HERO_ICONS[item.kind] : ListMusic;
  return (
    <>
      {hero && (
        <div className={styles.hero} data-kind={item.kind}>
          <span className={styles.heroCover}>
            {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the music service as they are */}
            {item.artwork ? <img src={item.artwork} alt="" referrerPolicy="no-referrer" /> : <HeroIcon size={32} strokeWidth={1.5} aria-hidden="true" />}
          </span>
          <span className={styles.heroText}>
            {KIND_LABEL[item.kind] && <span className={styles.heroKind}>{KIND_LABEL[item.kind]}</span>}
            <span className={styles.heroTitle}>{data?.title || item.title}</span>
            {item.subtitle && <span className={styles.heroMeta}>{item.subtitle}</span>}
            {item.playable && (
              <span className={styles.heroActions}>
                <button type="button" className={styles.playAll} disabled={disabled} onClick={() => onPlay(item)}>
                  <Play size={14} strokeWidth={0} fill="currentColor" aria-hidden="true" /> Play
                </button>
                <button type="button" className={styles.playAll} data-quiet disabled={disabled} onClick={() => onPlay(item, true)}>
                  <Shuffle size={14} strokeWidth={1.75} aria-hidden="true" /> Shuffle
                </button>
              </span>
            )}
          </span>
        </div>
      )}
      {error ? <p className={styles.note}>{error.message || "That did not open just now. Try again in a moment."}</p>
        : !data ? <div className={styles.rows} aria-label="Opening" role="status">{[0, 1, 2, 3].map(index => <span key={index} className={styles.skeletonRow} />)}</div>
        : data.items.length === 0 ? <p className={styles.note}>{data.note ?? "Nothing in here yet."}</p>
        : item ? <MediaItems items={data.items.map(child => child.subtitle && child.subtitle === item.title ? { ...child, subtitle: null } : child)} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
        : (
          <>
            <SectionHead title="Your library" />
            <MediaItems items={data.items.filter(child => child.kind === "other")} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
            <SectionHead title="Playlists" />
            <MediaItems items={data.items.filter(child => child.kind !== "other")} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
          </>
        )}
    </>
  );
}

