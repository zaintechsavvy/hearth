export const LISTEN_MS = 90_000;

const rest = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  const timer = setTimeout(done, ms);
  signal.addEventListener("abort", done, { once: true });
  function done() {
    clearTimeout(timer);
    signal.removeEventListener("abort", done);
    resolve();
  }
});

/**
 * Asks `sees` every `everyMs` whether Spotify Connect lists the speaker yet, for up to `timeoutMs`, and plays there
 * the moment it does. A failed look is tried again on the next one; `signal` stops the wait.
 */
export async function handOff({ sees, play, signal, timeoutMs = LISTEN_MS, everyMs = 1000 }: {
  sees: () => Promise<boolean>;
  play: () => Promise<void>;
  signal: AbortSignal;
  timeoutMs?: number;
  everyMs?: number;
}): Promise<"played" | "timeout" | "cancelled"> {
  const end = Date.now() + timeoutMs;
  while (!signal.aborted && Date.now() < end) {
    if (await sees().catch(() => false)) {
      if (signal.aborted) break;
      await play();
      return "played";
    }
    await rest(everyMs, signal);
  }
  return signal.aborted ? "cancelled" : "timeout";
}
