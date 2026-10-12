import type { Device, DeviceCommand } from "@/lib/devices/types";

export type IntegrationKind = "home-assistant" | "matter" | "demo";

export type IntegrationConfig =
  | { kind: "home-assistant"; url: string; token: string }
  | { kind: "matter"; url: string }
  | { kind: "demo" };

export interface Provider {
  /** Throws an `IntegrationError` with a readable message when the service cannot be reached. */
  check(): Promise<void>;
  listDevices(): Promise<Device[]>;
  execute(nativeId: string, command: DeviceCommand): Promise<void>;
  /** Starts pushing changes for as long as someone listens. Calls `onChange` whenever any device may have changed. */
  subscribe?(onChange: () => void): () => void;
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
