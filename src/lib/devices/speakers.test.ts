import { describe, expect, it } from "vitest";
import { mapHassState } from "@/lib/integrations/home-assistant";
import type { MediaItem } from "@/lib/integrations/types";
import { librariesFor, planPlay, playingOn, speakersFor, SPOTIFY_LIBRARY, type Library } from "./speakers";
import type { MediaPlayerDevice } from "./types";

const player = (entity_id: string, state: string, attributes: Record<string, unknown>, extra: Partial<MediaPlayerDevice> = {}) =>
  ({ ...mapHassState("ha", { entity_id, state, attributes }, "C") as MediaPlayerDevice, ...extra });

/** Spotify, which plays through Spotify Connect; a Google Home Mini Spotify sees, one it does not, and two to leave out. */
const spotify = player("media_player.spotify_alex", "playing", {
  friendly_name: "Spotify Alex", supported_features: 1 | 4 | 16 | 32 | 512 | 2048 | 131_072, source_list: ["Kitchen speaker", "Alex's iPhone"], source: "Alex's iPhone",
  media_content_id: "spotify:track:1", media_content_type: "music", volume_level: 0.4,
}, { platform: "spotify" });
const kitchen = player("media_player.kitchen_speaker", "off", { friendly_name: "Kitchen speaker", device_class: "speaker", supported_features: 152_463 }, { platform: "cast" });
const mini = player("media_player.bedroom_mini", "off", { friendly_name: "Bedroom mini", device_class: "speaker", supported_features: 152_463 }, { platform: "cast" });
const hidden = player("media_player.bedroom_mini_2", "off", { friendly_name: "Bedroom mini" }, { auxiliary: true });
const offline = player("media_player.garage", "unavailable", { friendly_name: "Garage" });
const home = [spotify, kitchen, mini, hidden, offline];
/** A player's own library, as the library panel finds it. */
const own = (device: MediaPlayerDevice) => librariesFor(device, [device]).find(library => library.id === device.id) as Library;
const track: MediaItem = { title: "Night Bus", subtitle: null, kind: "track", media: { id: "spotify:track:9", type: "spotify://track" }, artwork: null, playable: true, expandable: false };

describe("speakersFor", () => {
  it("maps a Google Cast speaker that is off as a usable media player", () => {
    expect(mini).toMatchObject({ kind: "media_player", available: true, state: "off", can: { play: true, volume: false, browse: true } });
  });

  it("lists every speaker in the home once, the current one first, without hidden or offline ones", () => {
    const speakers = speakersFor(spotify, home);
    expect(speakers.map(speaker => [speaker.name, speaker.via, speaker.current])).toEqual([
      ["Alex's iPhone", "output", true],
      ["Kitchen speaker", "output", false],
      ["Bedroom mini", "unreachable", false],
    ]);
    expect(speakers[1].device?.id).toBe(kitchen.id);
    expect(speakers[2].reason).toMatch(/Spotify cannot see Bedroom mini/);
  });

  it("shows a Cast speaker's own place and the others it can take the music to, but not the Spotify account", () => {
    const radio = { ...mini, media: { id: "media-source://radio_browser/abc", type: "audio/mpeg" } };
    expect(speakersFor(radio, home).map(speaker => [speaker.name, speaker.via])).toEqual([["Bedroom mini", "self"], ["Kitchen speaker", "move"]]);
  });

  it("offers grouping between players that can group, marking the grouped ones", () => {
    const a = player("media_player.a", "playing", { friendly_name: "A", supported_features: 524_288 | 512, group_members: ["media_player.a", "media_player.b"] });
    const b = player("media_player.b", "playing", { friendly_name: "B", supported_features: 524_288 | 512 });
    expect(speakersFor(a, [a, b])).toContainEqual(expect.objectContaining({ name: "B", via: "group", grouped: true }));
  });
});

describe("planPlay", () => {
  it("plays Spotify on a Cast speaker through Spotify Connect when Spotify sees it, and explains when it does not", () => {
    expect(planPlay(track, own(spotify), kitchen)).toMatchObject({ to: { id: spotify.id }, command: { type: "playMedia", id: "spotify:track:9", output: "Kitchen speaker" } });
    expect(planPlay(track, own(spotify), mini)).toMatchObject({ error: expect.stringMatching(/Spotify cannot see Bedroom mini/) });
    expect(planPlay(track, own(spotify), spotify)).toMatchObject({ to: { id: spotify.id }, command: { type: "playMedia" } });
  });

  it("plays anything else on the speaker itself", () => {
    const station = { ...track, media: { id: "media-source://radio_browser/abc", type: "audio/mpeg" } };
    expect(planPlay(station, own(kitchen), mini)).toMatchObject({ to: { id: mini.id }, command: { id: "media-source://radio_browser/abc" } });
  });

  it("plays from Spotify signed in from Hearth on the Spotify Connect device named like the speaker", () => {
    expect(planPlay(track, SPOTIFY_LIBRARY, { ...kitchen, sourceName: "Kitchen Home" })).toEqual({ spotify: ["Kitchen speaker", "Kitchen Home"] });
    expect(planPlay(track, SPOTIFY_LIBRARY, spotify)).toEqual({ spotify: ["Alex's iPhone"] });
    expect(planPlay(track, SPOTIFY_LIBRARY, idleSpotify)).toEqual({ spotify: [] });
  });
});

/** Home Assistant's Spotify with nothing playing: it reports only choosing a source, and refuses to browse. */
const idleSpotify = player("media_player.spotify_alex", "idle", { friendly_name: "Spotify Alex", supported_features: 2048, source_list: ["Kitchen speaker"] }, { platform: "spotify" });

describe("librariesFor", () => {
  it("offers Spotify's library first, then the speaker's own", () => {
    expect(librariesFor(mini, home).map(library => library.name)).toEqual(["Spotify", "Bedroom mini"]);
  });

  it("keeps Home Assistant's Spotify while it is idle and cannot browse, marked asleep", () => {
    expect(idleSpotify.can.browse).toBe(false);
    expect(librariesFor(mini, [idleSpotify, mini]).map(library => [library.name, library.asleep])).toEqual([["Spotify", true], ["Bedroom mini", false]]);
    expect(librariesFor(idleSpotify, [idleSpotify]).map(library => [library.id, library.asleep])).toEqual([[idleSpotify.id, true]]);
  });

  it("uses Spotify signed in from Hearth in place of Home Assistant's, which cannot search", () => {
    expect(librariesFor(mini, home, true).map(library => library.id)).toEqual(["spotify", mini.id]);
    expect(librariesFor(idleSpotify, [idleSpotify], true)).toEqual([SPOTIFY_LIBRARY]);
    expect(librariesFor(kitchen, [kitchen], false).map(library => [library.name, library.search])).toEqual([["Kitchen speaker", false]]);
  });
});

describe("app inputs", () => {
  const receiver = player("media_player.den", "on", {
    friendly_name: "Den receiver", supported_features: 2048 | 512 | 1, source_list: ["TV", "Spotify", "TuneIn", "Bluetooth", "AirPlay", "Apple Music"], source: "Spotify",
  }, { platform: "denonavr" });

  it("are not offered as speakers, and Spotify among them opens the Spotify library when there is one", () => {
    expect(speakersFor(receiver, [receiver]).map(speaker => [speaker.name, speaker.via])).toEqual([["TV", "output"], ["Bluetooth", "output"]]);
    expect(speakersFor(receiver, [receiver], true).map(speaker => [speaker.name, speaker.via])).toEqual([["Spotify", "library"], ["TV", "output"], ["Bluetooth", "output"]]);
  });

  it("are not where the music plays", () => {
    expect(playingOn(receiver)).toBe("Den receiver");
    expect(playingOn({ ...receiver, output: "TV" })).toBe("TV");
    expect(playingOn(spotify)).toBe("Alex's iPhone");
    expect(playingOn(idleSpotify)).toBe("Choose a speaker");
  });

  it("stay as Spotify's own Spotify Connect devices", () => {
    const named = { ...spotify, outputs: ["Spotify Connect", "Kitchen speaker"] };
    expect(speakersFor(named, home).filter(speaker => speaker.via === "output").map(speaker => speaker.name)).toEqual(["Spotify Connect", "Kitchen speaker"]);
  });
});
