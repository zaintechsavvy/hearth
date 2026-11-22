import { describe, expect, it } from "vitest";
import { LIKED, matchDevice, playBody, playlistItem, spotifyMessage, trackItem, type SpotifyDevice } from "./items";

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
