"use client";

import useSWR from "swr";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import type { SearchResult, SearchType } from "@/lib/spotify/items";
import { fetchJson } from "./media-hooks";
import { MediaItems } from "./media-items";
import { SearchMessage } from "./search-message";
import { SearchSkeleton } from "./search-skeleton";
import { SectionHead } from "./section-head";
import { Shelf } from "./shelf";
import { TopResult } from "./top-result";
import styles from "./library.module.css";

const SHELVES = [["artist", "Artists"], ["album", "Albums"], ["playlist", "Playlists"]] as const;

/** Every kind of result at once: the top result beside the first songs, then a row each of artists, albums, and playlists. */
export function SearchOverview({ query, device, disabled, onType, onOpen, onPlay }: {
  query: string; device: MediaPlayerDevice; disabled: boolean; onType: (type: SearchType) => void; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void;
}) {
  const { data, error, mutate, isLoading } = useSWR<SearchResult>(query ? `/api/spotify/search?${new URLSearchParams({ q: query })}` : null, fetchJson, { revalidateOnFocus: false, keepPreviousData: true });
  if (error && !data) return <SearchMessage title="Search did not work" text={error.message || "Spotify did not answer just now."} onRetry={() => void mutate()} />;
  if (!data) return <SearchSkeleton />;
  const { top, sections, next } = data;
  const tracks = sections.track ?? [];
  if (!top && SHELVES.every(([type]) => !sections[type]?.length)) return <SearchMessage title={`Nothing found for “${query}”`} text="Check the spelling, or try fewer words." />;
  return (
    <div className={styles.results} data-stale={isLoading || undefined}>
      <div className={styles.topGrid}>
        {top && (
          <section className={styles.section} aria-label="Top result">
            <SectionHead title="Top result" />
            <TopResult item={top} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
          </section>
        )}
        {tracks.length > 0 && (
          <section className={styles.section} aria-label="Songs">
            <SectionHead title="Songs" onMore={tracks.length > 4 || next.track != null ? () => onType("track") : undefined} />
            <MediaItems items={tracks.slice(0, 4)} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
          </section>
        )}
      </div>
      {SHELVES.map(([type, title]) => sections[type]?.length ? (
        <section key={type} className={styles.section} aria-label={title}>
          <SectionHead title={title} onMore={next[type] != null ? () => onType(type) : undefined} />
          <Shelf items={sections[type]} label={title} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />
        </section>
      ) : null)}
    </div>
  );
}
