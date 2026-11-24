import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { query: { spotifyLink: { findFirst: async () => ({ accessToken: "token", refreshToken: "refresh", expiresAt: new Date(Date.now() + 3_600_000) }) } } } }));
vi.mock("@/lib/crypto", () => ({ seal: (value: unknown) => value, unseal: (value: unknown) => value }));

const { play } = await import("./client");

/** Spotify's player API, where the Bedroom mini joins Spotify Connect once `joined` is set. */
function spotifyApi() {
  const calls: string[] = [];
  const state = { joined: false };
  vi.stubGlobal("fetch", async (input: URL, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}${init?.body ? ` ${init.body}` : ""}`);
    if (url.pathname.endsWith("/me/player/devices")) {
      const devices = [{ id: "phone", name: "Alex's iPhone", is_active: true, is_restricted: false }, ...(state.joined ? [{ id: "mini", name: "Bedroom mini", is_active: false, is_restricted: false }] : [])];
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
    const wake = vi.fn(async () => { setTimeout(() => { api.state.joined = true; }, 2500); return "woken" as const; });
    const done = play("home", { media: { id: "spotify:album:1", type: "album" }, speakers: ["Bedroom mini"], shuffle: false, wake });
    await vi.advanceTimersByTimeAsync(4000);
    await done;
    expect(wake).toHaveBeenCalledWith({ media: { id: "spotify:album:1", type: "album" }, shuffle: false });
    expect(api.calls.at(-1)).toBe(`PUT /v1/me/player/play?device_id=mini {"context_uri":"spotify:album:1"}`);
  });

  it("leaves it to the wake when that already started Spotify there", async () => {
    const api = spotifyApi();
    await play("home", { media: { id: "spotify:album:1", type: "album" }, speakers: ["Bedroom mini"], shuffle: false, wake: async () => "started" });
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

  it("says why when the speaker never joins", async () => {
    spotifyApi();
    const done = play("home", { media: null, speakers: ["Bedroom mini"], shuffle: false, wake: async () => "woken" });
    const failed = expect(done).rejects.toThrow(/Spotify cannot see Bedroom mini/);
    await vi.advanceTimersByTimeAsync(12_000);
    await failed;
  });
});
