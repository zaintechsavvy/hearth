import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { query: { spotifyLink: { findFirst: async () => ({ accessToken: "token", refreshToken: "refresh", expiresAt: new Date(Date.now() + 3_600_000) }) } } } }));
vi.mock("@/lib/crypto", () => ({ seal: (value: unknown) => value, unseal: (value: unknown) => value }));

const { play } = await import("./client");
const { SpeakerAsleepError } = await import("@/lib/integrations/types");

const woken = (names = ["Bedroom mini"], voice = true) => ({ started: false as const, names, late: "Google Assistant did not start Spotify on Bedroom mini.", voice });

/** Spotify's player API, where the Bedroom mini joins Spotify Connect once `joined` is set. */
function spotifyApi(joinsAs = "Bedroom mini") {
  const calls: string[] = [];
  const state = { joined: false };
  vi.stubGlobal("fetch", async (input: URL, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}${init?.body ? ` ${init.body}` : ""}`);
    if (url.pathname.endsWith("/me/player/devices")) {
      const devices = [{ id: "phone", name: "Alex's iPhone", is_active: true, is_restricted: false }, ...(state.joined ? [{ id: "mini", name: joinsAs, is_active: false, is_restricted: false }] : [])];
      return Response.json({ devices });
    }
    return new Response(null, { status: 204 });
  });
  return { calls, state };
}

describe("play", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("wakes a speaker Spotify cannot see, waits for it to join, then plays there", async () => {
    const api = spotifyApi();
    const wake = vi.fn(async () => { setTimeout(() => { api.state.joined = true; }, 2500); return woken(); });
    const done = play("home", { media: { id: "spotify:album:1", type: "album" }, speakers: ["Bedroom mini"], shuffle: false, wake });
    await vi.advanceTimersByTimeAsync(4000);
    await done;
    expect(wake).toHaveBeenCalledWith({ media: { id: "spotify:album:1", type: "album" }, shuffle: false });
    expect(api.calls.at(-1)).toBe(`PUT /v1/me/player/play?device_id=mini {"context_uri":"spotify:album:1"}`);
  });

  it("leaves it to the wake when that already started Spotify there", async () => {
    const api = spotifyApi();
    await play("home", { media: { id: "spotify:album:1", type: "album" }, speakers: ["Bedroom mini"], shuffle: false, wake: async () => ({ started: true as const }) });
    expect(api.calls).toEqual(["GET /v1/me/player/devices"]);
  });

  it("moves what plays now to a speaker Spotify sees, without asking to wake it", async () => {
    const api = spotifyApi();
    api.state.joined = true;
    const wake = vi.fn();
    await play("home", { media: null, speakers: ["Bedroom mini"], shuffle: false, wake });
    expect(wake).not.toHaveBeenCalled();
    expect(api.calls.at(-1)).toBe(`PUT /v1/me/player {"device_ids":["mini"],"play":true}`);
  });

  it("finds a woken speaker by the name Google gives it, then plays there", async () => {
    const api = spotifyApi("Bedroom speaker");
    const wake = async () => { setTimeout(() => { api.state.joined = true; }, 1500); return woken(["Bedroom speaker", "Bedroom mini"]); };
    const done = play("home", { media: null, speakers: ["Bedroom mini"], shuffle: false, wake });
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(api.calls.at(-1)).toBe(`PUT /v1/me/player {"device_ids":["mini"],"play":true}`);
  });

  it("waits fifteen seconds, then says the Google speaker is asleep so it can be asked for by voice", async () => {
    spotifyApi();
    const done = play("home", { media: null, speakers: ["Bedroom mini"], shuffle: false, wake: async () => woken() });
    const failed = expect(done).rejects.toSatisfy(error => error instanceof SpeakerAsleepError && /Google Assistant did not start Spotify/.test(error.message));
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(7000);
    await failed;
  });

  it("gives a plain reason for a speaker that turned on but never joined", async () => {
    spotifyApi();
    const done = play("home", { media: null, speakers: ["Bedroom mini"], shuffle: false, wake: async () => woken(["Bedroom mini"], false) });
    const failed = expect(done).rejects.toSatisfy(error => !(error instanceof SpeakerAsleepError));
    await vi.advanceTimersByTimeAsync(17_000);
    await failed;
  });
});
