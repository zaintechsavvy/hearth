import { describe, expect, it } from "vitest";
import { LIKED } from "@/lib/spotify/items";
import { spotcastCall, wakeMethodOf } from "./spotcast";

const v6 = new Set(["spotcast.play_media", "spotcast.transfer_playback", "spotcast.play_liked_songs"]);
const v3 = new Set(["spotcast.start"]);
const media_player = { entity_id: "media_player.mini" };

describe("spotcastCall", () => {
  it("plays, plays liked songs, or moves playback with Spotcast 6, starting a playlist's song inside the playlist", () => {
    expect(spotcastCall(v6, "media_player.mini", { id: "spotify:album:1", type: "album" }, true)).toEqual({ service: "play_media", data: { media_player, spotify_uri: "spotify:album:1", data: { shuffle: true } }, started: true });
    expect(spotcastCall(v6, "media_player.mini", { id: "spotify:track:1", type: "spotify:playlist:9" }, false)?.data).toEqual({ media_player, spotify_uri: "spotify:track:1", data: { shuffle: false, track_context: "spotify:playlist:9" } });
    expect(spotcastCall(v6, "media_player.mini", { id: LIKED, type: "directory" }, false)).toMatchObject({ service: "play_liked_songs", started: true });
    expect(spotcastCall(v6, "media_player.mini", null, false)).toEqual({ service: "transfer_playback", data: { media_player }, started: true });
  });

  it("names the Spotcast 6 account to use when Hearth found one", () => {
    expect(spotcastCall(v6, "media_player.mini", null, false, "01JDG07KSBTYWZGJSBJ1EW6XEF")?.data).toEqual({ media_player, account: "01JDG07KSBTYWZGJSBJ1EW6XEF" });
  });

  it("uses Spotcast 3's start, which only wakes the speaker for liked songs so Hearth plays them after", () => {
    expect(spotcastCall(v3, "media_player.mini", { id: "spotify:playlist:1", type: "playlist" }, false)).toEqual({ service: "start", data: { entity_id: "media_player.mini", force_playback: true, shuffle: false, uri: "spotify:playlist:1" }, started: true });
    expect(spotcastCall(v3, "media_player.mini", { id: LIKED, type: "directory" }, false)).toMatchObject({ service: "start", started: false });
  });

  it("is null without Spotcast", () => {
    expect(spotcastCall(new Set(["media_player.play_media"]), "media_player.mini", null, false)).toBeNull();
  });

  it("prefers Spotcast to the Google Assistant SDK for waking speakers", () => {
    expect(wakeMethodOf(new Set([...v3, "google_assistant_sdk.send_text_command"]))).toBe("spotcast");
    expect(wakeMethodOf(new Set(["google_assistant_sdk.send_text_command"]))).toBe("assistant");
    expect(wakeMethodOf(new Set(["media_player.turn_on"]))).toBeNull();
  });
});
