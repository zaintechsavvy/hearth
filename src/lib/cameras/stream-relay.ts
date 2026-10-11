import { IntegrationError } from "@/lib/integrations/types";

export interface CameraSource {
  url: string;
  username?: string;
  password?: string;
}

/** The URL API percent-encodes credentials, so passwords with `@`, `:` or `/` survive. */
export function rtspSource({ url, username, password }: CameraSource) {
  const parsed = new URL(url);
  if (username) parsed.username = username;
  if (password) parsed.password = password;
  return parsed.toString();
}

export const relayStreamName = (cameraId: string) => `hearth_${cameraId.replaceAll("-", "")}`;

/** go2rtc's HTTP API. It turns RTSP into WebRTC, so the browser never sees camera credentials. */
export class StreamRelay {
  private readonly base: URL;

  constructor(url: string) {
    this.base = new URL(url.endsWith("/") ? url : `${url}/`);
  }

  private async fetch(path: string, init?: RequestInit) {
    try {
      return await fetch(new URL(path, this.base), { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(10_000) });
    } catch {
      throw new IntegrationError(`Could not reach the stream relay at ${this.base.origin}.`);
    }
  }

  async check() {
    const response = await this.fetch("api/streams");
    if (!response.ok) throw new IntegrationError(`The stream relay answered with ${response.status}.`);
  }

  /** Creates or replaces the stream. go2rtc answers 400 when it cannot persist its config file, after the stream already exists in memory. */
  async upsert(name: string, source: CameraSource) {
    const response = await this.fetch(`api/streams?${new URLSearchParams({ name, src: rtspSource(source) })}`, { method: "PUT" });
    if (response.ok) return;
    const detail = await response.text();
    if (response.status === 400 && detail.includes("config file")) return;
    throw new IntegrationError(`The stream relay rejected the camera: ${detail.trim() || response.status}.`);
  }

  async remove(name: string) {
    await this.fetch(`api/streams?${new URLSearchParams({ src: name })}`, { method: "DELETE" });
  }

  /** Exchanges a complete SDP offer for an answer; go2rtc has no trickle ICE over HTTP. Returns null when the stream is unknown. */
  async answer(name: string, sdp: string): Promise<string | null> {
    const response = await this.fetch(`api/webrtc?${new URLSearchParams({ src: name })}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "offer", sdp }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new IntegrationError(`The stream relay could not start the stream (${response.status}).`);
    const body = await response.json() as { sdp?: string };
    if (!body.sdp) throw new IntegrationError("The stream relay sent an empty answer.");
    return body.sdp;
  }

  snapshot(name: string) {
    return this.fetch(`api/frame.jpeg?${new URLSearchParams({ src: name, cache: "2s" })}`);
  }
}
