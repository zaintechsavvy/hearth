import type { DeviceCommand, MediaPlayerDevice, RepeatMode } from "@/lib/devices/types";

interface Image { url: string }
interface Named { name: string }
/** A song or a podcast episode, as Spotify's player and queue describe them. */
export interface SpotifyItem {
  name: string;
  uri: string;
  duration_ms?: number;
  artists?: Named[];
  album?: { name?: string; images?: Image[] | null };
  show?: { name?: string; images?: Image[] | null };
  images?: Image[] | null;
}
export interface SpotifyState {
  device?: { name: string; volume_percent?: number | null } | null;
  is_playing: boolean;
  progress_ms?: number | null;
  shuffle_state?: boolean;
  repeat_state?: "off" | "context" | "track";
  context?: { uri: string } | null;
  item?: SpotifyItem | null;
}

/** What the home's Spotify plays now, and where. */
export interface Playback {
  speaker: string | null;
  volume: number | null;
  playing: boolean;
  title: string;
  artist: string | null;
  album: string | null;
  artwork: string | null;
  /** Seconds in when Spotify was asked. */
  position: number;
  duration: number | null;
  shuffle: boolean;
  repeat: RepeatMode;
  media: { id: string; type: string };
}

export interface QueuedTrack { title: string; artist: string | null; artwork: string | null; duration: number | null; uri: string }

const REPEAT = { off: "off", context: "all", track: "one" } as const;
const seconds = (ms?: number | null) => (ms ? Math.round(ms / 1000) : null);
/** Spotify lists covers largest first: the middle one suits a row, the largest the open player. */
const picture = (images?: Image[] | null) => (images?.[1] ?? images?.[0])?.url ?? null;
const largest = (images?: Image[] | null) => images?.[0]?.url ?? null;
const artistOf = (item: SpotifyItem) => item.artists?.map(artist => artist.name).join(", ") || item.show?.name || null;

export function playbackOf(state: SpotifyState | null): Playback | null {
  const item = state?.item;
  if (!state || !item) return null;
  return {
    speaker: state.device?.name ?? null,
    volume: state.device?.volume_percent ?? null,
    playing: state.is_playing,
    title: item.name,
    artist: artistOf(item),
    album: item.album?.name ?? null,
    artwork: largest(item.album?.images ?? item.images ?? item.show?.images),
    position: (state.progress_ms ?? 0) / 1000,
    duration: seconds(item.duration_ms),
    shuffle: Boolean(state.shuffle_state),
    repeat: REPEAT[state.repeat_state ?? "off"],
    media: { id: item.uri, type: state.context?.uri ?? "music" },
  };
}

export const queueOf = (items: (SpotifyItem | null)[]): QueuedTrack[] => items.flatMap(item => item?.uri ? [{
  title: item.name, artist: artistOf(item), artwork: picture(item.album?.images ?? item.images ?? item.show?.images), duration: seconds(item.duration_ms), uri: item.uri,
}] : []);

const plain = (name: string) => name.trim().toLowerCase();

/** Whether `playback` is this player's: Home Assistant's Spotify plays wherever Spotify does; a speaker, when Spotify plays on it. */
export function playsOn(device: MediaPlayerDevice, playback: Playback | null): playback is Playback {
  if (!playback) return false;
  if (device.platform === "spotify") return true;
  return playback.speaker !== null && [device.name, device.sourceName].some(name => name && plain(name) === plain(playback.speaker ?? ""));
}

/** The player as Spotify reports it, asked at `at`; Home Assistant's own Spotify can be half a minute behind. */
export function withPlayback(device: MediaPlayerDevice, playback: Playback, at: number): MediaPlayerDevice {
  const transport = { pause: true, seek: true, next: true, previous: true, shuffle: true, repeat: true, play: true };
  return {
    ...device,
    state: playback.playing ? "playing" : "paused",
    title: playback.title,
    artist: playback.artist,
    album: playback.album,
    artwork: playback.artwork ?? device.artwork,
    position: playback.position,
    positionAt: new Date(at).toISOString(),
    duration: playback.duration,
    volume: playback.volume ?? device.volume,
    shuffle: playback.shuffle,
    repeat: playback.repeat,
    media: playback.media,
    output: device.platform === "spotify" ? playback.speaker : device.output,
    can: device.platform === "spotify" ? { ...device.can, ...transport, volume: playback.volume !== null } : device.can,
  };
}

/** Spotify's own controls for a player command, for the ones Spotify has. */
export type SpotifyControl =
  | { action: "play" | "pause" | "next" | "previous" }
  | { action: "seek"; position: number }
  | { action: "volume"; value: number }
  | { action: "shuffle"; on: boolean }
  | { action: "repeat"; mode: RepeatMode }
  | { action: "skip"; count: number };

export function spotifyControl(command: DeviceCommand): SpotifyControl | null {
  switch (command.type) {
    case "media": return { action: command.action };
    case "seek": return { action: "seek", position: command.position };
    case "volume": return { action: "volume", value: command.value };
    case "shuffle": return { action: "shuffle", on: command.on };
    case "repeat": return { action: "repeat", mode: command.mode };
    default: return null;
  }
}
