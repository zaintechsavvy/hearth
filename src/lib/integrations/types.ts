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
  /** Adds an RTSP camera to the integration itself, so it streams the way the integration's other cameras do. Returns the new camera's id. */
  addRtspCamera?(source: { url: string; username?: string; password?: string }, name: string): Promise<string>;
  /** Starts an HLS stream for a camera and returns the playlist's path upstream, for `cameraHlsFetch`. */
  cameraHls?(nativeId: string): Promise<string>;
  /** What a media player played recently, and what it plays next when it knows. */
  mediaQueue?(nativeId: string, current: string | null, askQueue: boolean): Promise<{ recent: { title: string; artist: string | null; media: { id: string; type: string } | null }[]; next: { title: string; artist: string | null; media: { id: string; type: string } | null } | null }>;
  /** Music a media player can find by name: songs, albums, artists, and playlists. */
  searchMedia?(nativeId: string, query: string): Promise<MediaItem[]>;
  /** What is inside an album, artist, or playlist that search found. */
  browseMedia?(nativeId: string, media: { id: string; type: string }): Promise<{ title: string; items: MediaItem[] }>;
  /** The rooms a robot vacuum has mapped and can be sent to clean, by the integration's own area ids. */
  vacuumAreas?(nativeId: string): Promise<{ id: string; name: string }[]>;
  /** The items on a shopping or to-do list. */
  todoItems?(nativeId: string): Promise<{ uid: string; summary: string; done: boolean }[]>;
  /** The cover art of what a media player is playing. */
  artwork?(nativeId: string, signal: AbortSignal): Promise<Response>;
  /** A device's readings between two times, from the integration's own history, or null when it keeps none. */
  history?(nativeId: string, from: Date, to: Date): Promise<HistoryPoint[] | null>;
  /** Everything the integration itself recorded happening between two times, oldest first, including changes made outside Hearth. */
  /** What the integration recorded between two times, for these devices when given, which is far quicker on a busy home. */
  logbook?(from: Date, to: Date, nativeIds?: string[]): Promise<LogbookEntry[]>;
  /** Fetches a playlist or segment of a stream `cameraHls` started. */
  cameraHlsFetch?(path: string, search: string, signal: AbortSignal): Promise<Response>;
}

export interface MediaItem {
  title: string;
  /** The artist, or the album's artist, when the integration says. */
  subtitle: string | null;
  kind: "track" | "album" | "artist" | "playlist" | "other";
  /** How to ask the player for it, with `playMedia` or `browseMedia`. */
  media: { id: string; type: string };
  /** A cover the browser can load as it is, or null. */
  artwork: string | null;
  playable: boolean;
  /** It holds more items, such as an album's songs. */
  expandable: boolean;
}

export interface LogbookEntry {
  at: Date;
  /** The device's id within the integration, or null for an event about the integration itself. */
  nativeId: string | null;
  name: string;
  /** Lower case, after the name: "turned on", "unlocked". */
  what: string;
  /** Who or what made the change, such as a person or "the Bedtime automation", when the integration knows. */
  by: string | null;
  /** Where it was done, when not in Hearth: "in Home Assistant", or "at the device" for a wall switch or a remote. */
  via: string | null;
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
  /** Hands over the candidates that arrive after the answer, for as long as the session lasts. */
  onCandidate: (listener: (candidate: IceCandidate) => void) => void;
  /** Settles when the session ends upstream on its own, such as Home Assistant dropping the connection. */
  ended: Promise<void>;
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
