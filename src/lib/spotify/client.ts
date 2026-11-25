import "server-only";
import { eq } from "drizzle-orm";
import { seal, unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { spotifyLink } from "@/lib/db/schema";
import { IntegrationError, SpeakerAsleepError, type MediaItem, type SpotifyWoken } from "@/lib/integrations/types";
import {
  ALBUMS, ARTISTS, LIKED, SEARCH_LIMIT, SEARCH_TYPES, albumItem, artistItem, folderItem, likedItem, matchDevice, playBody, playlistItem, recentContexts, recentTracks,
  spotifyMessage, topResult, trackItem,
  type SearchResult, type SearchType, type SpotifyAlbum, type SpotifyArtist, type SpotifyDevice, type SpotifyPlay, type SpotifyPlaylist, type SpotifyTrack,
} from "./items";
import { playbackOf, queueOf, type SpotifyControl, type SpotifyItem, type SpotifyState } from "./playback";

const API = "https://api.spotify.com/v1/";

class SpotifyError extends IntegrationError {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

type Link = typeof spotifyLink.$inferSelect;
interface Token { access_token: string; refresh_token?: string; expires_in: number }
interface Page<T> { items: T[]; next: string | null }

export const envClientId = () => process.env.SPOTIFY_CLIENT_ID?.trim() || null;
export const spotifyLinkOf = (homeId: string) => db.query.spotifyLink.findFirst({ where: eq(spotifyLink.userId, homeId) });
export const clientIdOf = (row: Link | undefined) => row?.clientId ?? envClientId();

async function token(body: Record<string, string>): Promise<Token> {
  let response: Response;
  try {
    response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", body: new URLSearchParams(body), cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new IntegrationError("Spotify did not answer. Try again in a moment.");
  }
  const answer = await response.json().catch(() => null) as (Token & { error?: string; error_description?: string }) | null;
  if (!response.ok || !answer?.access_token) throw new SpotifyError(`Spotify did not sign Hearth in: ${answer?.error_description ?? answer?.error ?? response.status}.`, response.status, answer?.error);
  return answer;
}

const sealed = (answer: Token) => ({
  accessToken: seal(answer.access_token), expiresAt: new Date(Date.now() + answer.expires_in * 1000), ...(answer.refresh_token ? { refreshToken: seal(answer.refresh_token) } : {}),
});

export async function completeSignIn(homeId: string, clientId: string, code: string, verifier: string, redirectUri: string) {
  const answer = await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier });
  const me = await fetch(`${API}me`, { headers: { Authorization: `Bearer ${answer.access_token}` }, cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null) as { display_name?: string | null; id?: string } | null;
  const values = { ...sealed(answer), account: me?.display_name || me?.id || null };
  await db.insert(spotifyLink).values({ userId: homeId, ...values }).onConflictDoUpdate({ target: spotifyLink.userId, set: values });
  playlists.delete(homeId);
}

export async function signOut(homeId: string) {
  await db.update(spotifyLink).set({ accessToken: null, refreshToken: null, expiresAt: null, account: null }).where(eq(spotifyLink.userId, homeId));
  playlists.delete(homeId);
}

const refreshing = new Map<string, Promise<string>>();

async function refresh(homeId: string, row: Link & { refreshToken: string }) {
  const clientId = clientIdOf(row);
  if (!clientId) throw new IntegrationError("Spotify has no Client ID. Add it in Settings.");
  try {
    const answer = await token({ grant_type: "refresh_token", refresh_token: unseal<string>(row.refreshToken), client_id: clientId });
    await db.update(spotifyLink).set(sealed(answer)).where(eq(spotifyLink.userId, homeId));
    return answer.access_token;
  } catch (error) {
    if (!(error instanceof SpotifyError) || error.code !== "invalid_grant") throw error;
    await signOut(homeId);
    throw new IntegrationError("Spotify signed Hearth out. Connect Spotify again in Settings.");
  }
}

/** A live access token, refreshed a minute before it runs out, once however many requests ask at the same moment. */
async function accessToken(homeId: string) {
  const row = await spotifyLinkOf(homeId);
  if (!row?.refreshToken) throw new IntegrationError("Spotify is not connected. Connect it in Settings.");
  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() - 60_000 > Date.now()) return unseal<string>(row.accessToken);
  let pending = refreshing.get(homeId);
  if (!pending) {
    pending = refresh(homeId, { ...row, refreshToken: row.refreshToken }).finally(() => refreshing.delete(homeId));
    refreshing.set(homeId, pending);
  }
  return pending;
}

async function spotify<T>(homeId: string, path: string, init?: RequestInit): Promise<T> {
  const bearer = await accessToken(homeId);
  let response: Response;
  try {
    response = await fetch(new URL(path, API), { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${bearer}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  } catch {
    throw new IntegrationError("Spotify did not answer. Try again in a moment.");
  }
  const text = await response.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!response.ok) throw new SpotifyError(spotifyMessage(response.status, body), response.status, body?.error?.reason);
  return body as T;
}

async function pages<T>(homeId: string, path: string, max: number) {
  const items: T[] = [];
  let next: string | null = path;
  for (let page = 0; next && page < max; page++) {
    const answer: Page<T> = await spotify<Page<T>>(homeId, next);
    items.push(...answer.items);
    next = answer.next;
  }
  return items;
}

/** Each home's own playlists, kept a minute so the library and searching them stay quick. */
const playlists = new Map<string, { at: number; items: MediaItem[] }>();

async function ownPlaylists(homeId: string) {
  const kept = playlists.get(homeId);
  if (kept && Date.now() - kept.at < 60_000) return kept.items;
  const items = (await pages<SpotifyPlaylist | null>(homeId, "me/playlists?limit=50", 20)).flatMap(playlist => playlist ? [playlistItem(playlist)] : []);
  playlists.set(homeId, { at: Date.now(), items });
  return items;
}

const liked = (homeId: string, max: number) => pages<{ track: SpotifyTrack }>(homeId, "me/tracks?limit=50", max);
const spotifyId = (uri: string) => encodeURIComponent(uri.split(":").at(-1) ?? "");

export async function browse(homeId: string, media: { id: string; type: string } | null): Promise<{ title: string; items: MediaItem[]; note?: string }> {
  if (!media) return { title: "Spotify", items: [folderItem("Albums", ALBUMS), folderItem("Artists", ARTISTS), likedItem(), ...await ownPlaylists(homeId)] };
  if (media.id === LIKED) return { title: "Liked songs", items: (await liked(homeId, 4)).flatMap(entry => trackItem(entry.track, LIKED)) };
  if (media.id === ALBUMS) return { title: "Albums", items: (await pages<{ album: SpotifyAlbum }>(homeId, "me/albums?limit=50", 4)).map(entry => albumItem(entry.album)) };
  if (media.id === ARTISTS) {
    const answer = await spotify<{ artists: Page<SpotifyArtist> }>(homeId, "me/following?type=artist&limit=50");
    return { title: "Artists", items: answer.artists.items.map(artistItem) };
  }
  const [, kind] = media.id.split(":");
  if (kind === "playlist") {
    const playlist = await spotify<{ name: string }>(homeId, `playlists/${spotifyId(media.id)}?fields=name`);
    try {
      const entries = await pages<{ item?: SpotifyTrack | null; track?: SpotifyTrack | null }>(homeId, `playlists/${spotifyId(media.id)}/items?limit=50`, 6);
      return { title: playlist.name, items: entries.flatMap(entry => trackItem(entry.item ?? entry.track, media.id)) };
    } catch (error) {
      if (!(error instanceof SpotifyError) || error.status !== 403) throw error;
      return { title: playlist.name, items: [], note: "Spotify only lists the songs in playlists you made or collaborate on. Play it to hear it." };
    }
  }
  if (kind === "album") {
    const album = await spotify<SpotifyAlbum & { tracks: Page<SpotifyTrack> }>(homeId, `albums/${spotifyId(media.id)}`);
    return { title: album.name, items: album.tracks.items.flatMap(track => trackItem(track, media.id, album.images)) };
  }
  if (kind === "artist") {
    const [artist, albums] = await Promise.all([
      spotify<SpotifyArtist>(homeId, `artists/${spotifyId(media.id)}`),
      spotify<Page<SpotifyAlbum>>(homeId, `artists/${spotifyId(media.id)}/albums?include_groups=album,single&limit=50`),
    ]);
    return { title: artist.name, items: albums.items.map(albumItem) };
  }
  throw new IntegrationError("Spotify cannot open that.");
}

/**
 * Every kind of result, or one kind from `offset` on. The home's own matching playlists, which Spotify's search
 * leaves out, lead the playlists on the first page.
 */
export async function search(homeId: string, query: string, type: SearchType | null, offset = 0): Promise<SearchResult> {
  const types = type ? [type] : [...SEARCH_TYPES];
  const words = query.toLowerCase();
  const [own, found] = await Promise.all([
    types.includes("playlist") && offset === 0 ? ownPlaylists(homeId) : [],
    spotify<Partial<Record<`${SearchType}s`, Page<unknown | null>>>>(homeId, `search?${new URLSearchParams({ q: query, type: types.join(","), limit: String(SEARCH_LIMIT), offset: String(offset) })}`),
  ]);
  const mine = own.filter(item => item.title.toLowerCase().includes(words));
  const known = new Set(mine.map(item => item.media.id));
  const map = {
    track: (track: unknown) => trackItem(track as SpotifyTrack),
    artist: (artist: unknown) => [artistItem(artist as SpotifyArtist)],
    album: (album: unknown) => [albumItem(album as SpotifyAlbum)],
    playlist: (playlist: unknown) => [playlistItem(playlist as SpotifyPlaylist)].filter(item => !known.has(item.media.id)),
  };
  const result: SearchResult = { top: null, sections: {}, next: {} };
  for (const kind of types) {
    const page = found[`${kind}s`];
    result.sections[kind] = [...(kind === "playlist" ? mine : []), ...(page?.items ?? []).flatMap(entry => entry ? map[kind](entry) : [])];
    result.next[kind] = page?.next ? offset + SEARCH_LIMIT : null;
  }
  if (!type) result.top = topResult(query, result.sections);
  return result;
}

/** What each recently played album, playlist, or artist is called and looks like, kept a while since that seldom changes. */
const contexts = new Map<string, { at: number; item: MediaItem }>();

async function contextItem(homeId: string, { type, uri, track }: ReturnType<typeof recentContexts>[number], own: MediaItem[]) {
  if (type === "collection") return likedItem();
  const key = `${homeId}:${uri}`;
  const kept = contexts.get(key);
  if (kept && Date.now() - kept.at < 600_000) return kept.item;
  const item = type === "album" ? albumItem(track.album?.uri === uri && track.album.name ? track.album as SpotifyAlbum : await spotify<SpotifyAlbum>(homeId, `albums/${spotifyId(uri)}`))
    : type === "playlist" ? own.find(mine => mine.media.id === uri) ?? playlistItem(await spotify<SpotifyPlaylist>(homeId, `playlists/${spotifyId(uri)}?fields=name,uri,images,owner(display_name)`))
    : artistItem(await spotify<SpotifyArtist>(homeId, `artists/${spotifyId(uri)}`));
  contexts.set(key, { at: Date.now(), item });
  return item;
}

/**
 * What played lately: the albums, playlists, and artists, then the songs. A sign in from before Hearth asked to read
 * recent plays is refused by Spotify, which says to connect again rather than failing.
 */
export async function recent(homeId: string): Promise<{ items: MediaItem[]; tracks: MediaItem[] } | { reconnect: true }> {
  let plays: SpotifyPlay[];
  try {
    plays = (await spotify<{ items: SpotifyPlay[] }>(homeId, "me/player/recently-played?limit=50")).items;
  } catch (error) {
    if (error instanceof SpotifyError && (error.status === 401 || error.status === 403)) return { reconnect: true };
    throw error;
  }
  const own = await ownPlaylists(homeId).catch(() => []);
  const items = await Promise.allSettled(recentContexts(plays).map(context => contextItem(homeId, context, own)));
  return { items: items.flatMap(answer => answer.status === "fulfilled" ? [answer.value] : []), tracks: recentTracks(plays) };
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type Wake = (start: { media: { id: string; type: string } | null; shuffle: boolean }) => Promise<SpotifyWoken>;

const WAKE_WAIT_MS = 15_000;

const devices = async (homeId: string) => (await spotify<{ devices: SpotifyDevice[] }>(homeId, "me/player/devices")).devices;

/** The names of the Spotify Connect devices Spotify can play on now. */
export const spotifyDeviceNames = async (homeId: string) => (await devices(homeId)).map(device => device.name);

/**
 * Plays `media` on the Spotify Connect device named like one of `speakers`, or where Spotify plays now when none are
 * given; without `media`, moves what Spotify plays now there. A speaker Spotify cannot see yet, such as an idle
 * Google Cast speaker, is woken with `wake` and looked for every second until it joins. A speaker Spotify has gone
 * quiet on can refuse to start until playback is moved to it, so that is tried once.
 */
export async function play(homeId: string, { media, speakers, shuffle, wake }: { media: { id: string; type: string } | null; speakers: string[]; shuffle: boolean; wake?: Wake }) {
  let device = matchDevice(await devices(homeId), speakers);
  if (speakers.length && !device && wake) {
    const woken = await wake({ media, shuffle });
    if (woken.started) return;
    const names = [...speakers, ...woken.names];
    for (const end = Date.now() + WAKE_WAIT_MS; !device && Date.now() < end;) {
      await pause(1000);
      device = matchDevice(await devices(homeId), names);
    }
    if (!device) throw new (woken.voice ? SpeakerAsleepError : IntegrationError)(woken.late);
  }
  if (speakers.length && !device) throw new IntegrationError(`Spotify cannot see ${speakers[0]} yet. Play to it once from the Spotify app and it joins Spotify Connect, then Hearth can start music on it.`);
  if (device?.is_restricted) throw new IntegrationError(`${device.name} does not take commands from Hearth. Start it from the Spotify app.`);
  if (!media) {
    if (!device) throw new IntegrationError("Choose a speaker to play on.");
    return void await spotify(homeId, "me/player", { method: "PUT", body: JSON.stringify({ device_ids: [device.id], play: true }) });
  }
  const uris = media.id === LIKED || media.type === LIKED ? (await liked(homeId, 2)).flatMap(entry => entry.track?.uri ? [entry.track.uri] : []) : [];
  const target = device ? `device_id=${encodeURIComponent(device.id)}` : "";
  const start = () => spotify(homeId, `me/player/play${target ? `?${target}` : ""}`, { method: "PUT", body: JSON.stringify(playBody(media, uris)) });
  try {
    await start();
  } catch (error) {
    if (!device || !(error instanceof SpotifyError) || error.status !== 404) throw error;
    await spotify(homeId, "me/player", { method: "PUT", body: JSON.stringify({ device_ids: [device.id], play: false }) });
    await pause(700);
    await start();
  }
  if (shuffle) await spotify(homeId, `me/player/shuffle?state=true${target ? `&${target}` : ""}`, { method: "PUT" });
}

/** What Spotify plays now and where, or null when it plays nothing. */
export const playback = async (homeId: string) => playbackOf(await spotify<SpotifyState | null>(homeId, "me/player?additional_types=episode"));

/** What Spotify plays next. A sign in from before Hearth asked to read the queue is refused, which says to connect again. */
export async function queue(homeId: string) {
  try {
    const answer = await spotify<{ queue?: (SpotifyItem | null)[] } | null>(homeId, "me/player/queue");
    return { tracks: queueOf(answer?.queue ?? []) };
  } catch (error) {
    if (error instanceof SpotifyError && (error.status === 401 || error.status === 403)) return { reconnect: true as const };
    throw error;
  }
}

const REPEAT_STATE = { off: "off", all: "context", one: "track" } as const;

/** Controls Spotify wherever it plays now. `skip` goes forward through the queue, one track at a time, as Spotify has no jump. */
export async function control(homeId: string, command: SpotifyControl) {
  const put = (path: string) => spotify(homeId, `me/player/${path}`, { method: "PUT" });
  const post = (path: string) => spotify(homeId, `me/player/${path}`, { method: "POST" });
  switch (command.action) {
    case "play": case "pause": return void await put(command.action);
    case "next": case "previous": return void await post(command.action);
    case "seek": return void await put(`seek?position_ms=${Math.max(0, Math.round(command.position * 1000))}`);
    case "volume": return void await put(`volume?volume_percent=${Math.round(Math.min(100, Math.max(0, command.value)))}`);
    case "shuffle": return void await put(`shuffle?state=${command.on}`);
    case "repeat": return void await put(`repeat?state=${REPEAT_STATE[command.mode]}`);
    case "skip": for (let step = 0; step < command.count; step++) await post("next");
  }
}
