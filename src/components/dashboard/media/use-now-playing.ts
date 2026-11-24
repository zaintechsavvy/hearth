"use client";

import useSWR from "swr";
import { useHome } from "@/components/dashboard/use-home";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { playsOn, type Playback } from "@/lib/spotify/playback";
import { fetchJson } from "./media-hooks";

export const PLAYBACK_KEY = "/api/spotify/player";

/** Spotify's playback with when it was asked, so a reading can be told apart from one taken before a command. */
export interface Reading { playback: Playback | null; at: number }

const read = async (url: string): Promise<Reading> => {
  const at = Date.now();
  return { playback: await fetchJson<Playback | null>(url), at };
};

/** The home's Spotify, read every `ms`; every reader shares one request. */
export function useSpotifyPlayback(enabled: boolean, ms: number) {
  return useSWR<Reading>(enabled ? PLAYBACK_KEY : null, read, { refreshInterval: ms, dedupingInterval: 750, keepPreviousData: true, shouldRetryOnError: false });
}

export interface NowPlaying { title: string; artist: string | null; artwork: string | null; playing: boolean; device: MediaPlayerDevice | null }

/** What plays in the home now: Spotify when it plays, then any speaker that does. */
export function useNowPlaying(): NowPlaying | null {
  const { home } = useHome();
  const { data } = useSpotifyPlayback(Boolean(home?.spotifyLinked), 10_000);
  const players = (home?.devices ?? []).filter((device): device is MediaPlayerDevice => device.kind === "media_player" && device.available && !device.auxiliary);
  const spotify = data?.playback?.playing ? data.playback : null;
  if (spotify) {
    const on = players.filter(device => playsOn(device, spotify));
    return { title: spotify.title, artist: spotify.artist, artwork: spotify.artwork, playing: true, device: on.find(device => device.platform !== "spotify") ?? on[0] ?? null };
  }
  const device = players.find(player => player.state === "playing" && player.title);
  return device?.title ? { title: device.title, artist: device.artist, artwork: device.artwork, playing: true, device } : null;
}
