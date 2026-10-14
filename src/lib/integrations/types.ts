import type { Device, DeviceCommand } from "@/lib/devices/types";

export type IntegrationKind = "home-assistant" | "matter" | "demo";

export type IntegrationConfig =
  | { kind: "home-assistant"; url: string; token: string }
  | { kind: "matter"; url: string }
  | { kind: "demo" };

export interface DeviceList {
  devices: Device[];
  /** What the integration saw but Hearth cannot show yet, counted by type, such as `{ update: 6 }`. */
  unsupported: Record<string, number>;
}

export interface Provider {
  /** Throws an `IntegrationError` with a readable message when the service cannot be reached. */
  check(): Promise<void>;
  listDevices(): Promise<DeviceList>;
  execute(nativeId: string, command: DeviceCommand): Promise<void>;
  /** Starts pushing changes for as long as someone listens. Calls `onChange` whenever any device may have changed. */
  subscribe?(onChange: () => void): () => void;
  /** A camera's live MJPEG stream or a single JPEG, for integrations that relay camera video. */
  camera?(nativeId: string, mode: "stream" | "snapshot", signal: AbortSignal): Promise<Response>;
  /** Answers a browser's WebRTC offer for a camera. Throws `WebRtcUnsupportedError` when that camera has no WebRTC. */
  cameraWebRtc?(nativeId: string, offer: string): Promise<WebRtcAnswer>;
  /** Whether this camera offers WebRTC, and the ICE servers the browser should use for it, such as a STUN server. */
  cameraWebRtcConfig?(nativeId: string): Promise<{ supported: boolean; iceServers: IceServer[] }>;
  /** Starts an HLS stream for a camera and returns the playlist's path upstream, for `cameraHlsFetch`. */
  cameraHls?(nativeId: string): Promise<string>;
  /** What a media player played recently, and what it plays next when it knows. */
  mediaQueue?(nativeId: string, current: string | null, askQueue: boolean): Promise<{ recent: { title: string; artist: string | null; media: { id: string; type: string } | null }[]; next: { title: string; artist: string | null; media: { id: string; type: string } | null } | null }>;
  /** The items on a shopping or to-do list. */
  todoItems?(nativeId: string): Promise<{ uid: string; summary: string; done: boolean }[]>;
  /** The cover art of what a media player is playing. */
  artwork?(nativeId: string, signal: AbortSignal): Promise<Response>;
  /** A device's readings between two times, from the integration's own history, or null when it keeps none. */
  history?(nativeId: string, from: Date, to: Date): Promise<HistoryPoint[] | null>;
  /** Fetches a playlist or segment of a stream `cameraHls` started. */
  cameraHlsFetch?(path: string, search: string, signal: AbortSignal): Promise<Response>;
}

export interface HistoryPoint {
  /** Epoch milliseconds. */
  t: number;
  v: number;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface WebRtcAnswer {
  answer: string;
  candidates: IceCandidate[];
  /** Ends the session upstream; the media stops when it does. */
  close: () => void;
}

export function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/** An error whose message is safe and useful to show the person who owns the integration. */
export class IntegrationError extends Error {
  override name = "IntegrationError";
}

export class WebRtcUnsupportedError extends IntegrationError {
  override name = "WebRtcUnsupportedError";
}

export const INTEGRATION_LABELS: Record<IntegrationKind, string> = {
  "home-assistant": "Home Assistant",
  matter: "Matter server",
  demo: "Demo home",
};
