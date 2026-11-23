import type { MediaItem } from "@/lib/integrations/types";

interface Image { url: string }
interface Named { name: string }
export interface SpotifyPlaylist { name: string; uri: string; images?: Image[] | null; owner?: { display_name?: string | null } | null }
export interface SpotifyAlbum { name: string; uri: string; images?: Image[] | null; artists?: Named[] }
export interface SpotifyArtist { name: string; uri: string; images?: Image[] | null }
export interface SpotifyTrack { name: string; uri: string; type?: string; is_local?: boolean; duration_ms?: number; artists?: Named[]; album?: Partial<SpotifyAlbum> }
export interface SpotifyPlay { track: SpotifyTrack | null; context: { type: string; uri: string } | null }
export interface SpotifyDevice { id: string | null; name: string; is_active: boolean; is_restricted: boolean }

/** A Spotify app's Client ID, which is public: PKCE signs in without a secret. */
export const isClientId = (value: string) => /^[0-9a-f]{32}$/i.test(value);

/** Folders Hearth adds at the top of the library; they are not Spotify ids. */
export const LIKED = "hearth:liked";
export const ALBUMS = "hearth:albums";
export const ARTISTS = "hearth:artists";

/** Spotify lists covers largest first; the middle one suits a card or a row. */
const cover = (images?: Image[] | null) => (images?.[1] ?? images?.[0])?.url ?? null;
const artists = (list?: Named[]) => list?.map(artist => artist.name).join(", ") || null;

export const folderItem = (title: string, id: string): MediaItem => ({ title, subtitle: null, kind: "other", media: { id, type: "folder" }, artwork: null, playable: false, expandable: true });
export const likedItem = (): MediaItem => ({ title: "Liked songs", subtitle: null, kind: "playlist", media: { id: LIKED, type: "playlist" }, artwork: null, playable: true, expandable: true });

export const playlistItem = (playlist: SpotifyPlaylist): MediaItem => ({
  title: playlist.name, subtitle: playlist.owner?.display_name ?? null, kind: "playlist", media: { id: playlist.uri, type: "playlist" }, artwork: cover(playlist.images), playable: true, expandable: true,
});

export const albumItem = (album: SpotifyAlbum): MediaItem => ({
  title: album.name, subtitle: artists(album.artists), kind: "album", media: { id: album.uri, type: "album" }, artwork: cover(album.images), playable: true, expandable: true,
});

export const artistItem = (artist: SpotifyArtist): MediaItem => ({
  title: artist.name, subtitle: null, kind: "artist", media: { id: artist.uri, type: "artist" }, artwork: cover(artist.images), playable: true, expandable: true,
});

/** A song, keeping the playlist or album it was found in as its type, so playing it carries on through the rest. */
export function trackItem(track: SpotifyTrack | null | undefined, context = "track", images?: Image[] | null): MediaItem[] {
  if (!track?.uri || track.is_local || (track.type && track.type !== "track")) return [];
  return [{
    title: track.name, subtitle: artists(track.artists), kind: "track", media: { id: track.uri, type: context }, artwork: cover(track.album?.images ?? images), playable: true, expandable: false,
    duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
  }];
}

export const SEARCH_TYPES = ["track", "artist", "album", "playlist"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const isSearchType = (value: unknown): value is SearchType => SEARCH_TYPES.includes(value as SearchType);
export interface SearchResult {
  top: MediaItem | null;
  sections: Partial<Record<SearchType, MediaItem[]>>;
  /** The offset of the next page of each section, or null at the end. */
  next: Partial<Record<SearchType, number | null>>;
}

/** Spotify's most per type for an app in development mode. */
export const SEARCH_LIMIT = 10;

/**
 * Spotify's search names no top result, so it is the leading artist, song, album, or playlist named exactly as
 * searched, in that order, then an artist whose name starts with it, then the first song.
 */
export function topResult(query: string, sections: Partial<Record<SearchType, MediaItem[]>>) {
  const wanted = plain(query);
  const leading = (type: SearchType) => (sections[type] ?? []).slice(0, 3);
  for (const type of ["artist", "track", "album", "playlist"] as const) {
    const exact = leading(type).find(item => plain(item.title) === wanted);
    if (exact) return exact;
  }
  return leading("artist").find(item => wanted && plain(item.title).startsWith(wanted)) ?? SEARCH_TYPES.map(type => sections[type]?.[0]).find(Boolean) ?? null;
}

/** The context a play counts towards: its album, playlist, artist, or liked songs, or its song's album when it had none. */
function contextOf({ track, context }: SpotifyPlay) {
  if (context && ["album", "playlist", "artist", "collection"].includes(context.type)) return { type: context.type, uri: context.uri };
  return track?.album?.uri ? { type: "album", uri: track.album.uri } : null;
}

/** Albums, playlists, artists, and liked songs played lately, newest first and once each, with a song played from each. */
export function recentContexts(plays: SpotifyPlay[], max = 12) {
  const found = new Map<string, { type: string; uri: string; track: SpotifyTrack }>();
  for (const play of plays) {
    const context = contextOf(play);
    if (play.track && context && !found.has(context.uri)) found.set(context.uri, { ...context, track: play.track });
  }
  return [...found.values()].slice(0, max);
}

/** Songs played lately, newest first and once each, playing on through the album or playlist they were played from. */
export function recentTracks(plays: SpotifyPlay[], max = 10) {
  const seen = new Set<string>();
  return plays.flatMap(play => {
    if (!play.track?.uri || seen.has(play.track.uri)) return [];
    seen.add(play.track.uri);
    const context = contextOf(play);
    return trackItem(play.track, context?.type === "collection" ? LIKED : context?.type === "artist" ? "track" : context?.uri);
  }).slice(0, max);
}

const plain = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The Spotify Connect device that is one of these speakers, by name: an exact match first, then one name holding the
 * other, as "Kitchen" and "Kitchen speaker". With no names, whichever device Spotify is playing on.
 */
export function matchDevice(devices: SpotifyDevice[], names: string[]) {
  const usable = devices.filter((device): device is SpotifyDevice & { id: string } => Boolean(device.id));
  if (!names.length) return usable.find(device => device.is_active) ?? null;
  const wanted = names.map(plain).filter(Boolean);
  return usable.find(device => wanted.includes(plain(device.name)))
    ?? usable.find(device => wanted.some(name => plain(device.name).includes(name) || name.includes(plain(device.name))))
    ?? null;
}

/** What to ask Spotify to play. A song found in a playlist or album starts there and plays on through it. */
export function playBody(media: { id: string; type: string }, liked: string[] = []) {
  if (media.id === LIKED) return { uris: liked };
  if (media.type === LIKED) return { uris: liked.includes(media.id) ? liked : [media.id, ...liked], offset: { uri: media.id } };
  if (/^spotify:track:/.test(media.id)) return media.type.startsWith("spotify:") ? { context_uri: media.type, offset: { uri: media.id } } : { uris: [media.id] };
  return { context_uri: media.id };
}

/** Spotify's own words, plainly, with what to do for the errors people meet. */
export function spotifyMessage(status: number, body: unknown) {
  const error = (body as { error?: { message?: string; reason?: string } | string } | null)?.error;
  const message = typeof error === "string" ? error : error?.message;
  const reason = typeof error === "object" ? error?.reason : undefined;
  if (reason === "PREMIUM_REQUIRED" || (status === 403 && /premium/i.test(message ?? ""))) return `Spotify Premium is needed to start music from Hearth. Spotify said: ${message ?? "Premium required"}.`;
  if (reason === "NO_ACTIVE_DEVICE") return "Spotify is not playing anywhere yet. Choose a speaker first.";
  if (status === 401) return "Spotify signed Hearth out. Connect Spotify again in Settings.";
  if (status === 429) return "Spotify asked Hearth to slow down. Try again in a moment.";
  return message ? `Spotify said: ${message}` : `Spotify answered with ${status}.`;
}
