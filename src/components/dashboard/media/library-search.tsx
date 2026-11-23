"use client";

import { useState } from "react";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import type { SearchType } from "@/lib/spotify/items";
import { SearchList } from "./search-list";
import { SearchOverview } from "./search-overview";
import styles from "./media-tile.module.css";

const FILTERS = [["top", "Top"], ["track", "Songs"], ["artist", "Artists"], ["album", "Albums"], ["playlist", "Playlists"]] as const;

/** Searching Spotify: everything at once under Top, or one kind at a time. */
export function LibrarySearch({ query, device, disabled, onOpen, onPlay }: {
  query: string; device: MediaPlayerDevice; disabled: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void;
}) {
  const [filter, setFilter] = useState<SearchType | "top">("top");
  return (
    <>
      <div className={styles.sources} role="radiogroup" aria-label="Show">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={filter === value} className={styles.source} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {filter === "top"
        ? <SearchOverview query={query} device={device} disabled={disabled} onType={setFilter} onOpen={onOpen} onPlay={onPlay} />
        : <SearchList key={filter} query={query} type={filter} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />}
    </>
  );
}
