"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { MediaItem } from "@/lib/integrations/types";
import { fetchJson } from "./media-hooks";
import { MediaItems } from "./media-items";
import { SectionHead } from "./section-head";
import { Shelf } from "./shelf";
import { ShelfSkeleton } from "./shelf-skeleton";
import styles from "./library.module.css";

type Recent = { items: MediaItem[]; tracks: MediaItem[] } | { reconnect: true };

/** What Spotify played lately: albums, playlists, and artists as covers, then a few songs. */
export function RecentShelf({ device, disabled, onOpen, onPlay }: { device: MediaPlayerDevice; disabled: boolean; onOpen: (item: MediaItem) => void; onPlay: (item: MediaItem) => void }) {
  const { data, error, mutate, isValidating } = useSWR<Recent>("/api/spotify/recent", fetchJson, { revalidateOnFocus: false });
  if (data && "reconnect" in data) {
    return (
      <section className={styles.section} aria-label="Recent">
        <SectionHead title="Recent" />
        <p className={styles.inlineNote}>
          <span>Reconnect Spotify to see recent plays.</span>
          <Link href="/settings#spotify" className={styles.inlineAction}>Reconnect</Link>
        </p>
      </section>
    );
  }
  if (data && !data.items.length && !data.tracks.length) return null;
  return (
    <section className={styles.section} aria-label="Recent" aria-busy={!data && !error}>
      <SectionHead title="Recent" />
      {error ? (
        <p className={styles.inlineNote}>
          <span>{error.message || "Recent plays did not load just now."}</span>
          <button type="button" className={styles.inlineAction} disabled={isValidating} onClick={() => void mutate()}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> Try again</button>
        </p>
      ) : !data ? <ShelfSkeleton /> : (
        <>
          {data.items.length > 0 && <Shelf items={data.items} label="Recently played" disabled={disabled} onOpen={onOpen} onPlay={onPlay} />}
          {data.tracks.length > 0 && <MediaItems items={data.tracks.slice(0, 5)} device={device} disabled={disabled} onOpen={onOpen} onPlay={onPlay} />}
        </>
      )}
    </section>
  );
}
