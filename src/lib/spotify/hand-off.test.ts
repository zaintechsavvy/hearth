import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handOff } from "./hand-off";

describe("handOff", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("plays once, the moment Spotify Connect lists the speaker", async () => {
    let looks = 0;
    const play = vi.fn(async () => {});
    const done = handOff({ sees: async () => ++looks === 4, play, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(3500);
    expect(await done).toBe("played");
    expect(looks).toBe(4);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps looking through a failed look", async () => {
    let looks = 0;
    const done = handOff({ sees: async () => { if (++looks === 1) throw new Error("offline"); return looks === 2; }, play: async () => {}, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await done).toBe("played");
  });

  it("gives up after the wait without playing", async () => {
    const play = vi.fn(async () => {});
    const done = handOff({ sees: async () => false, play, signal: new AbortController().signal, timeoutMs: 90_000 });
    await vi.advanceTimersByTimeAsync(91_000);
    expect(await done).toBe("timeout");
    expect(play).not.toHaveBeenCalled();
  });

  it("stops at once when cancelled", async () => {
    const abort = new AbortController();
    const play = vi.fn(async () => {});
    const done = handOff({ sees: async () => false, play, signal: abort.signal });
    await vi.advanceTimersByTimeAsync(2500);
    abort.abort();
    expect(await done).toBe("cancelled");
    expect(play).not.toHaveBeenCalled();
  });

  it("does not play when cancelled while the last look was out", async () => {
    const abort = new AbortController();
    const play = vi.fn(async () => {});
    const done = handOff({ sees: async () => { abort.abort(); return true; }, play, signal: abort.signal });
    expect(await done).toBe("cancelled");
    expect(play).not.toHaveBeenCalled();
  });
});
