import type { MediaItem } from "./types";
import { TRACKS } from "./demo-devices";

const ALBUMS = [
  { title: "Low Water", songs: [["Undertow", 204], ["Lantern Pier", 231], ["Salt in the Rope", 189]] },
  { title: "Summer Paper", songs: [["Kites Over Kerry", 214], ["Open Windows", 238], ["Late Light", 201]] },
  { title: "After Hours", songs: [["Last Stop", 226], ["Sodium Lamps", 193], ["Window Seat", 247]] },
  { title: "Notebook", songs: [["Margins", 168], ["Pressed Flowers", 182], ["Pencil Rain", 199]] },
] as const;

/** One song the demo can play: the four playlist tracks lead their artists' albums. */
export interface LibrarySong { title: string; artist: string; duration: number; artwork: string; media: { id: string; type: string }; album: number }

export const LIBRARY_SONGS: LibrarySong[] = ALBUMS.flatMap((album, index) => [
  { ...TRACKS[index], album: index },
  ...album.songs.map(([title, duration], at) => ({
    title, duration, artist: TRACKS[index].artist, artwork: TRACKS[index].artwork, media: { id: `demo:song:${index}:${at}`, type: "music" }, album: index,
  })),
]);

/** Playlists as song titles, so they read like someone made them. */
const PLAYLISTS = [
  { title: "Morning coffee", songs: ["Open Windows", "Fieldnotes", "Kites Over Kerry", "Margins", "Slow Tide", "Late Light"] },
  { title: "Rainy afternoon", songs: ["Pencil Rain", "Undertow", "Window Seat", "Pressed Flowers", "Lantern Pier"] },
  { title: "Dinner party", songs: ["Paper Planes in June", "Sodium Lamps", "Salt in the Rope", "Night Bus", "Last Stop"] },
] as const;

const playlistSongs = (index: number) => PLAYLISTS[index].songs.flatMap(title => LIBRARY_SONGS.filter(song => song.title === title));

export const albumOf = (title: string | null) => ALBUMS[LIBRARY_SONGS.find(song => song.title === title)?.album ?? -1]?.title ?? null;

const albumItem = (index: number): MediaItem => ({
  title: ALBUMS[index].title, subtitle: TRACKS[index].artist, kind: "album", media: { id: `demo:album:${index}`, type: "album" }, artwork: TRACKS[index].artwork, playable: true, expandable: true,
});
const artistItem = (index: number): MediaItem => ({
  title: TRACKS[index].artist, subtitle: null, kind: "artist", media: { id: `demo:artist:${index}`, type: "artist" }, artwork: TRACKS[index].artwork, playable: true, expandable: true,
});
const playlistItem = (index: number): MediaItem => ({
  title: PLAYLISTS[index].title, subtitle: `${PLAYLISTS[index].songs.length} songs`, kind: "playlist", media: { id: `demo:playlist:${index}`, type: "playlist" },
  artwork: playlistSongs(index)[0]?.artwork ?? null, playable: true, expandable: true,
});
const songItem = (song: LibrarySong): MediaItem => ({ title: song.title, subtitle: song.artist, kind: "track", media: song.media, artwork: song.artwork, playable: true, expandable: false });
const folder = (title: string, id: string): MediaItem => ({ title, subtitle: null, kind: "other", media: { id, type: "directory" }, artwork: null, playable: false, expandable: true });

const indexes = (length: number) => Array.from({ length }, (_, index) => index);

export function searchLibrary(query: string): MediaItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...fields: string[]) => words.every(word => fields.some(field => field.toLowerCase().includes(word)));
  return [
    ...LIBRARY_SONGS.filter(song => matches(song.title, song.artist, ALBUMS[song.album].title)).map(songItem),
    ...indexes(ALBUMS.length).filter(index => matches(ALBUMS[index].title, TRACKS[index].artist)).map(albumItem),
    ...indexes(ALBUMS.length).filter(index => matches(TRACKS[index].artist)).map(artistItem),
    ...indexes(PLAYLISTS.length).filter(index => matches(PLAYLISTS[index].title)).map(playlistItem),
  ];
}

/** The demo's library, laid out the way Home Assistant's Spotify browser is: folders at the top, then their items. */
export function browseLibrary(id: string | null): { title: string; items: MediaItem[] } | null {
  if (!id) return { title: "Library", items: [folder("Playlists", "demo:playlists"), folder("Albums", "demo:albums"), folder("Artists", "demo:artists"), folder("Songs", "demo:songs")] };
  if (id === "demo:playlists") return { title: "Playlists", items: indexes(PLAYLISTS.length).map(playlistItem) };
  if (id === "demo:albums") return { title: "Albums", items: indexes(ALBUMS.length).map(albumItem) };
  if (id === "demo:artists") return { title: "Artists", items: indexes(ALBUMS.length).map(artistItem) };
  if (id === "demo:songs") return { title: "Songs", items: LIBRARY_SONGS.map(songItem) };
  const [, kind, at] = id.split(":");
  const index = Number(at);
  if (kind === "playlist" && PLAYLISTS[index]) return { title: PLAYLISTS[index].title, items: playlistSongs(index).map(songItem) };
  if (!ALBUMS[index]) return null;
  if (kind === "album") return { title: ALBUMS[index].title, items: LIBRARY_SONGS.filter(song => song.album === index).map(songItem) };
  if (kind === "artist") return { title: TRACKS[index].artist, items: [albumItem(index)] };
  return null;
}

/** The songs a library id plays, in order: one song, or a whole album, artist, or playlist. */
export function songsOf(id: string): LibrarySong[] {
  const song = LIBRARY_SONGS.find(item => item.media.id === id);
  if (song) return [song];
  const [, kind, at] = id.split(":");
  if (kind === "playlist" && PLAYLISTS[Number(at)]) return playlistSongs(Number(at));
  return kind === "album" || kind === "artist" ? LIBRARY_SONGS.filter(item => item.album === Number(at)) : [];
}
