/**
 * Resolves once the video has painted a real frame, so "Live" means pictures and not just a connected call:
 * a stream can play audio alone, or carry video the browser cannot decode, and either would fire `playing`.
 * Pair it with `watchFrames`, since a first frame alone does not show the video is still moving.
 */
export function firstFrame(video: HTMLVideoElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    const painted = () => video.videoWidth > 0 && video.videoHeight > 0;
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      const wait = () => video.requestVideoFrameCallback(() => (painted() ? resolve() : wait()));
      wait();
      return;
    }
    const check = () => {
      if (!painted()) return;
      video.removeEventListener("timeupdate", check);
      resolve();
    };
    video.addEventListener("timeupdate", check, { signal });
  });
}

/** How long a playing video may go without a new frame before it no longer counts as live. */
const STILL_MS = 10_000;

/**
 * Calls `onStill` once the video stops showing new frames, or ends: a frozen call, a stalled stream, or a recording that
 * ran out. Time the tile is off screen or the page is hidden does not count, since browsers stop presenting frames then.
 */
export function watchFrames(video: HTMLVideoElement, signal: AbortSignal, onStill: () => void) {
  let last = performance.now();
  const fresh = () => { last = performance.now(); };
  if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
    const next = () => { if (!signal.aborted) video.requestVideoFrameCallback(() => { fresh(); next(); }); };
    next();
  } else {
    video.addEventListener("timeupdate", fresh, { signal });
  }
  let seen = true;
  const visibility = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; fresh(); });
  visibility.observe(video);
  document.addEventListener("visibilitychange", fresh, { signal });
  const stop = () => { clearInterval(timer); visibility.disconnect(); };
  const still = () => { stop(); if (!signal.aborted) onStill(); };
  video.addEventListener("ended", still, { once: true, signal });
  const timer = setInterval(() => {
    if (!seen || document.hidden) fresh();
    else if (performance.now() - last > STILL_MS) still();
  }, 1000);
  signal.addEventListener("abort", stop, { once: true });
}

export function timeout(ms: number, signal: AbortSignal, message: string) {
  return new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });
}

/** The addresses a WebRTC answer asks the browser to reach, for saying why a call could not connect. */
export function candidateHosts(sdp: string, extra: { candidate: string }[]) {
  const lines = [...sdp.split(/\r?\n/).filter(line => line.startsWith("a=candidate:")).map(line => line.slice(2)), ...extra.map(item => item.candidate)];
  const hosts = lines.map(line => line.split(" ")).filter(parts => parts.length > 5).map(parts => `${parts[4]}:${parts[5]}`);
  return [...new Set(hosts)];
}
