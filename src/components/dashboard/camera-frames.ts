/**
 * Resolves once the video has painted a real frame, so "Live" means pictures and not just a connected call:
 * a stream can play audio alone, or carry video the browser cannot decode, and either would fire `playing`.
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
