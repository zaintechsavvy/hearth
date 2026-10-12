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
  /** A complete, careful listing for choosing what to show. May take a little longer than `listDevices`. */
  review?(): Promise<DeviceList>;
  execute(nativeId: string, command: DeviceCommand): Promise<void>;
  /** Starts pushing changes for as long as someone listens. Calls `onChange` whenever any device may have changed. */
  subscribe?(onChange: () => void): () => void;
  /** A camera's live MJPEG stream or a single JPEG, for integrations that relay camera video. */
  camera?(nativeId: string, mode: "stream" | "snapshot", signal: AbortSignal): Promise<Response>;
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

export const INTEGRATION_LABELS: Record<IntegrationKind, string> = {
  "home-assistant": "Home Assistant",
  matter: "Matter server",
  demo: "Demo home",
};
