import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssistantProvider } from "./home-assistant";
import { SpeakerAsleepError } from "./types";

/** A Google Home Mini sitting idle, as the Cast integration reports it, in a Home Assistant offering `services`. */
function fakeHomeAssistant(services: Record<string, string[]>, { cast = ["media_player.bedroom_mini"], googleName = "Bedroom speaker" } = {}) {
  const calls: { service: string; data: unknown }[] = [];
  vi.stubGlobal("fetch", async (input: URL, init?: RequestInit) => {
    const { pathname } = new URL(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (pathname === "/api/services") return Response.json(Object.entries(services).map(([domain, names]) => ({ domain, services: Object.fromEntries(names.map(name => [name, {}])) })));
    if (pathname === "/api/template") return new Response(body.template.includes("integration_entities") ? JSON.stringify(cast) : googleName);
    if (pathname === "/api/states/media_player.bedroom_mini") return Response.json({ entity_id: "media_player.bedroom_mini", state: "off", attributes: { friendly_name: "Bedroom mini", supported_features: 152_463 } });
    if (pathname.startsWith("/api/services/")) {
      calls.push({ service: pathname.slice("/api/services/".length), data: body });
      return Response.json([]);
    }
    return new Response(null, { status: 404 });
  });
  return calls;
}

let server = 0;
const provider = () => new HomeAssistantProvider("ha", { url: `http://ha-${++server}.test:8123`, token: "token" });
const start = { media: { id: "spotify:album:1", type: "album" }, shuffle: false, account: null };

afterEach(() => { vi.unstubAllGlobals(); });

describe("waking a Google speaker into Spotify Connect", () => {
  it("finds Spotcast first, then the Google Assistant SDK, and lists the Cast speakers", async () => {
    fakeHomeAssistant({ spotcast: ["play_media", "transfer_playback"], google_assistant_sdk: ["send_text_command"] });
    expect(await provider().spotifyWake()).toEqual({ method: "spotcast", cast: ["media_player.bedroom_mini"] });
    fakeHomeAssistant({ google_assistant_sdk: ["send_text_command"], media_player: ["play_media"] });
    expect(await provider().spotifyWake()).toEqual({ method: "assistant", cast: ["media_player.bedroom_mini"] });
    fakeHomeAssistant({ media_player: ["play_media", "turn_on"] });
    expect(await provider().spotifyWake()).toEqual({ method: null, cast: ["media_player.bedroom_mini"] });
  });

  it("casts the chosen music with Spotcast", async () => {
    const calls = fakeHomeAssistant({ spotcast: ["play_media"] });
    expect(await provider().startSpotify("media_player.bedroom_mini", start)).toEqual({ started: true });
    expect(calls).toEqual([{ service: "spotcast/play_media", data: { media_player: { entity_id: "media_player.bedroom_mini" }, spotify_uri: "spotify:album:1", data: { shuffle: false } } }]);
  });

  it("asks Google Assistant to play Spotify on the speaker by its Google name, and says to wait for it", async () => {
    const calls = fakeHomeAssistant({ google_assistant_sdk: ["send_text_command"] });
    expect(await provider().startSpotify("media_player.bedroom_mini", start)).toMatchObject({ started: false, names: ["Bedroom speaker", "Bedroom mini"], voice: true });
    expect(calls).toEqual([{ service: "google_assistant_sdk/send_text_command", data: { command: "play Spotify on Bedroom speaker" } }]);
  });

  it("does not turn an idle Cast speaker on, which never brings Spotify, but says to ask it by voice", async () => {
    const calls = fakeHomeAssistant({ media_player: ["turn_on"] });
    await expect(provider().startSpotify("media_player.bedroom_mini", start)).rejects.toBeInstanceOf(SpeakerAsleepError);
    expect(calls).toEqual([]);
  });

  it("turns on a speaker that is not a Cast one", async () => {
    const calls = fakeHomeAssistant({ media_player: ["turn_on"] }, { cast: [] });
    expect(await provider().startSpotify("media_player.bedroom_mini", start)).toMatchObject({ started: false, voice: false });
    expect(calls).toEqual([{ service: "media_player/turn_on", data: { entity_id: "media_player.bedroom_mini" } }]);
  });
});
