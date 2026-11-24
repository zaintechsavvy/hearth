import { describe, expect, it } from "vitest";
import { mapHassState } from "@/lib/integrations/home-assistant";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { playbackOf, playsOn, queueOf, spotifyControl, withPlayback } from "./playback";

const images = [{ url: "https://i.scdn.co/640" }, { url: "https://i.scdn.co/300" }, { url: "https://i.scdn.co/64" }];
const state = {
  device: { name: "Bedroom mini", volume_percent: 35 }, is_playing: true, progress_ms: 61_500, shuffle_state: true, repeat_state: "context" as const,
  context: { uri: "spotify:playlist:9" }, item: { name: "Slow Tide", uri: "spotify:track:1", duration_ms: 222_000, artists: [{ name: "Harbor Lights" }], album: { name: "Low Water", images } },
};
const player = (entity_id: string, attributes: Record<string, unknown>, platform: string) =>
  ({ ...mapHassState("ha", { entity_id, state: "idle", attributes }, "C") as MediaPlayerDevice, platform });
const mini = player("media_player.bedroom_mini", { friendly_name: "Bedroom mini", supported_features: 152_463 }, "cast");
const account = player("media_player.spotify_alex", { friendly_name: "Spotify Alex", supported_features: 2048 }, "spotify");

describe("Spotify playback", () => {
  it("reads what plays, where, with the largest cover for the open player", () => {
    expect(playbackOf(state)).toEqual({
      speaker: "Bedroom mini", volume: 35, playing: true, title: "Slow Tide", artist: "Harbor Lights", album: "Low Water", artwork: "https://i.scdn.co/640",
      position: 61.5, duration: 222, shuffle: true, repeat: "all", media: { id: "spotify:track:1", type: "spotify:playlist:9" },
    });
    expect(playbackOf(null)).toBeNull();
    expect(playbackOf({ is_playing: false, item: null })).toBeNull();
  });

  it("belongs to the speaker it plays on, and always to Home Assistant's Spotify", () => {
    const playback = playbackOf(state);
    expect(playsOn(mini, playback)).toBe(true);
    expect(playsOn({ ...mini, name: "Kitchen" }, playback)).toBe(false);
    expect(playsOn(account, playback)).toBe(true);
  });

  it("brings an idle Home Assistant Spotify up to date, with controls, timed from when it was asked", () => {
    const live = withPlayback(account, playbackOf(state)!, Date.parse("2026-11-23T20:00:00Z"));
    expect(live).toMatchObject({ state: "playing", title: "Slow Tide", output: "Bedroom mini", position: 61.5, positionAt: "2026-11-23T20:00:00.000Z", volume: 35, can: { next: true, seek: true, volume: true } });
    expect(withPlayback(mini, playbackOf(state)!, 0)).toMatchObject({ output: mini.output, can: mini.can });
  });

  it("lists the queue, skipping gaps", () => {
    expect(queueOf([null, { name: "Night Bus", uri: "spotify:track:3", artists: [{ name: "The Quiet Hours" }], album: { images } }])).toEqual([
      { title: "Night Bus", artist: "The Quiet Hours", artwork: "https://i.scdn.co/300", duration: null, uri: "spotify:track:3" },
    ]);
  });

  it("turns player commands into Spotify's controls", () => {
    expect(spotifyControl({ type: "media", action: "next" })).toEqual({ action: "next" });
    expect(spotifyControl({ type: "repeat", mode: "one" })).toEqual({ action: "repeat", mode: "one" });
    expect(spotifyControl({ type: "join", members: [] })).toBeNull();
  });
});
