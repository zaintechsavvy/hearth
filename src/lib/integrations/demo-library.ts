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

const albumItem = (index: number): MediaItem => ({
  title: ALBUMS[index].title, subtitle: TRACKS[index].artist, kind: "album", media: { id: `demo:album:${index}`, type: "album" }, artwork: null, playable: true, expandable: true,
});
const artistItem = (index: number): MediaItem => ({
  title: TRACKS[index].artist, subtitle: null, kind: "artist", media: { id: `demo:artist:${index}`, type: "artist" }, artwork: null, playable: true, expandable: true,
});
const songItem = (song: LibrarySong): MediaItem => ({ title: song.title, subtitle: song.artist, kind: "track", media: song.media, artwork: null, playable: true, expandable: false });

export function searchLibrary(query: string): MediaItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...fields: string[]) => words.every(word => fields.some(field => field.toLowerCase().includes(word)));
  const indexes = ALBUMS.map((_, index) => index);
  return [
    ...LIBRARY_SONGS.filter(song => matches(song.title, song.artist, ALBUMS[song.album].title)).map(songItem),
    ...indexes.filter(index => matches(ALBUMS[index].title, TRACKS[index].artist)).map(albumItem),
    ...indexes.filter(index => matches(TRACKS[index].artist)).map(artistItem),
  ];
}

export function browseLibrary(id: string): { title: string; items: MediaItem[] } | null {
  const [, kind, at] = id.split(":");
  const index = Number(at);
  if (!ALBUMS[index]) return null;
  if (kind === "album") return { title: ALBUMS[index].title, items: LIBRARY_SONGS.filter(song => song.album === index).map(songItem) };
  if (kind === "artist") return { title: TRACKS[index].artist, items: [albumItem(index)] };
  return null;
}

/** The songs a library id plays, in order: one song, or a whole album or artist. */
export function songsOf(id: string): LibrarySong[] {
  const song = LIBRARY_SONGS.find(item => item.media.id === id);
  if (song) return [song];
  const [, kind, at] = id.split(":");
  return kind === "album" || kind === "artist" ? LIBRARY_SONGS.filter(item => item.album === Number(at)) : [];
}
