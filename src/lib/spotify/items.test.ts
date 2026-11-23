import { describe, expect, it } from "vitest";
import type { MediaItem } from "@/lib/integrations/types";
import {
  LIKED, isClientId, matchDevice, playBody, playlistItem, recentContexts, recentTracks, spotifyMessage, topResult, trackItem, type SpotifyDevice, type SpotifyPlay, type SpotifyTrack,
} from "./items";

const device = (name: string, extra: Partial<SpotifyDevice> = {}): SpotifyDevice => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, is_active: false, is_restricted: false, ...extra });

describe("matchDevice", () => {
  const devices = [device("Kitchen"), device("Living Room speaker"), device("Alex's iPhone", { is_active: true }), device("Ghost", { id: null })];

  it("finds the speaker's Spotify Connect device by name, exactly first, then by one name holding the other", () => {
    expect(matchDevice(devices, ["kitchen"])?.id).toBe("kitchen");
    expect(matchDevice(devices, ["Kitchen speaker"])?.id).toBe("kitchen");
    expect(matchDevice(devices, ["Living room"])?.id).toBe("living-room-speaker");
    expect(matchDevice(devices, ["Hallway", "Living Room Speaker"])?.id).toBe("living-room-speaker");
  });

  it("plays where Spotify plays now with no speaker given, and never on a device without an id", () => {
    expect(matchDevice(devices, [])?.name).toBe("Alex's iPhone");
    expect(matchDevice(devices, ["Ghost"])).toBeNull();
    expect(matchDevice(devices, ["Garage"])).toBeNull();
  });
});

describe("playBody", () => {
  it("starts a song inside the playlist or album it was found in, and anything else as itself", () => {
    expect(playBody({ id: "spotify:track:1", type: "spotify:playlist:9" })).toEqual({ context_uri: "spotify:playlist:9", offset: { uri: "spotify:track:1" } });
    expect(playBody({ id: "spotify:track:1", type: "track" })).toEqual({ uris: ["spotify:track:1"] });
    expect(playBody({ id: "spotify:album:2", type: "album" })).toEqual({ context_uri: "spotify:album:2" });
  });

  it("plays liked songs as a list, from the one chosen", () => {
    expect(playBody({ id: LIKED, type: "playlist" }, ["spotify:track:1", "spotify:track:2"])).toEqual({ uris: ["spotify:track:1", "spotify:track:2"] });
    expect(playBody({ id: "spotify:track:2", type: LIKED }, ["spotify:track:1", "spotify:track:2"])).toEqual({ uris: ["spotify:track:1", "spotify:track:2"], offset: { uri: "spotify:track:2" } });
  });
});

describe("items", () => {
  it("maps playlists and songs, leaving out local files and podcast episodes", () => {
    expect(playlistItem({ name: "Road trip", uri: "spotify:playlist:9", images: [{ url: "https://i/640" }, { url: "https://i/300" }], owner: { display_name: "Alex" } }))
      .toEqual({ title: "Road trip", subtitle: "Alex", kind: "playlist", media: { id: "spotify:playlist:9", type: "playlist" }, artwork: "https://i/300", playable: true, expandable: true });
    expect(trackItem({ name: "Night Bus", uri: "spotify:track:1", artists: [{ name: "A" }, { name: "B" }] }, "spotify:playlist:9")[0]).toMatchObject({ subtitle: "A, B", media: { type: "spotify:playlist:9" } });
    expect(trackItem({ name: "Demo", uri: "spotify:local:x", is_local: true })).toEqual([]);
    expect(trackItem({ name: "Episode", uri: "spotify:episode:1", type: "episode" })).toEqual([]);
    expect(trackItem(null)).toEqual([]);
  });
});

describe("spotifyMessage", () => {
  it("says plainly when Premium is needed, keeping Spotify's words", () => {
    expect(spotifyMessage(403, { error: { status: 403, message: "Player command failed: Premium required", reason: "PREMIUM_REQUIRED" } }))
      .toBe("Spotify Premium is needed to start music from Hearth. Spotify said: Player command failed: Premium required.");
    expect(spotifyMessage(404, { error: { status: 404, message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" } })).toMatch(/Choose a speaker/);
    expect(spotifyMessage(400, { error: { status: 400, message: "Invalid context uri" } })).toBe("Spotify said: Invalid context uri");
    expect(spotifyMessage(500, null)).toBe("Spotify answered with 500.");
  });
});

it("knows a Client ID when it sees one", () => {
  expect(isClientId("0123456789abcdef0123456789ABCDEF")).toBe(true);
  expect(isClientId("not-an-id")).toBe(false);
});

const song = (id: string, album = "a1"): SpotifyTrack => ({ name: `Song ${id}`, uri: `spotify:track:${id}`, duration_ms: 201_400, artists: [{ name: "Someone" }], album: { name: `Album ${album}`, uri: `spotify:album:${album}`, images: [{ url: `https://i/${album}` }] } });
const played = (track: SpotifyTrack | null, context: SpotifyPlay["context"] = null): SpotifyPlay => ({ track, context });

describe("recent plays", () => {
  const plays = [
    played(song("1"), { type: "playlist", uri: "spotify:playlist:p1" }),
    played(song("2"), { type: "playlist", uri: "spotify:playlist:p1" }),
    played(song("3", "a2")),
    played(song("1"), { type: "artist", uri: "spotify:artist:r1" }),
    played(song("4"), { type: "collection", uri: "spotify:user:me:collection" }),
    played(song("5", "a3"), { type: "album", uri: "spotify:album:a3" }),
    played(null, { type: "show", uri: "spotify:show:s1" }),
    played(song("6", "a2"), { type: "show", uri: "spotify:show:s1" }),
  ];

  it("lists each album, playlist, artist, and liked songs once, newest first, counting a song with no context as its album", () => {
    expect(recentContexts(plays).map(context => [context.type, context.uri])).toEqual([
      ["playlist", "spotify:playlist:p1"], ["album", "spotify:album:a2"], ["artist", "spotify:artist:r1"], ["collection", "spotify:user:me:collection"], ["album", "spotify:album:a3"],
    ]);
    expect(recentContexts(plays)[1].track.uri).toBe("spotify:track:3");
    expect(recentContexts(plays, 2)).toHaveLength(2);
  });

  it("lists each song once, playing on through where it was played from", () => {
    const tracks = recentTracks(plays);
    expect(tracks.map(track => [track.media.id, track.media.type])).toEqual([
      ["spotify:track:1", "spotify:playlist:p1"], ["spotify:track:2", "spotify:playlist:p1"], ["spotify:track:3", "spotify:album:a2"],
      ["spotify:track:4", LIKED], ["spotify:track:5", "spotify:album:a3"], ["spotify:track:6", "spotify:album:a2"],
    ]);
    expect(tracks[0]).toMatchObject({ duration: 201, artwork: "https://i/a1" });
    expect(recentTracks(plays, 3)).toHaveLength(3);
  });
});

describe("topResult", () => {
  const item = (title: string, kind: MediaItem["kind"]): MediaItem => ({ title, kind, subtitle: null, media: { id: `${kind}:${title}`, type: kind }, artwork: null, playable: true, expandable: kind !== "track" });

  it("prefers what is named exactly as searched, an artist first", () => {
    const sections = { track: [item("Hello", "track")], artist: [item("Adele", "artist"), item("Hello", "artist")], album: [item("Hello", "album")] };
    expect(topResult("hello", sections)?.kind).toBe("artist");
    expect(topResult("Hello!", { ...sections, artist: [] })?.kind).toBe("track");
  });

  it("then an artist whose name starts with the search, then the first song", () => {
    expect(topResult("radioh", { track: [item("Creep", "track")], artist: [item("Radiohead", "artist")] })?.title).toBe("Radiohead");
    expect(topResult("creep", { track: [item("Creep (Acoustic)", "track")], artist: [item("Radiohead", "artist")] })?.title).toBe("Creep (Acoustic)");
    expect(topResult("anything", {})).toBeNull();
  });
});
