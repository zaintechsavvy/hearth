"use client";

import { Fragment } from "react";
import useSWR from "swr";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { fetchJson } from "./media-hooks";
import { MediaItems } from "./media-items";
import styles from "./media-tile.module.css";

const SECTIONS = [["track", "Songs"], ["playlist", "Playlists"], ["album", "Albums"], ["artist", "Artists"], ["other", "More"]] as const;

export function LibrarySearch({ library, query, device, disabled, onOpen, onPlay }: {
  library: MediaPlayerDevice; query: string; device: MediaPlayerDevice; disabled: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void;
}) {
  const { data, error } = useSWR<{ items: MediaItem[] }>(query ? `/api/devices/${encodeURIComponent(library.id)}/media/search?q=${encodeURIComponent(query)}` : null, fetchJson, { revalidateOnFocus: false });
  if (error) return <p className={styles.note}>{error.message || "Search did not work just now. Try again in a moment."}</p>;
  if (!query || !data) return <p className={styles.note} role="status">Searching…</p>;
  if (!data.items.length) return <p className={styles.note}>Nothing found for “{query}”.</p>;
  return SECTIONS.map(([kind, label]) => {
    const items = data.items.filter(item => item.kind === kind);
    return items.length > 0 && (
      <Fragment key={kind}>
        <span className={styles.groupLabel}>{label}</span>
        <MediaItems items={items} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
      </Fragment>
    );
  });
}
