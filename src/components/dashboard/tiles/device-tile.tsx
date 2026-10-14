"use client";

import type { TileConfig } from "@/lib/dashboard/layout";
import type { CameraDevice, Device, DeviceCommand, MediaPlayerDevice, ThermostatDevice } from "@/lib/devices/types";
import { StateTile } from "./state-tile";
import { ToggleTile } from "./toggle-tile";

export type TileDevice = Exclude<Device, ThermostatDevice | CameraDevice | MediaPlayerDevice>;

interface DeviceTileProps {
  device: TileDevice;
  config: TileConfig;
  onCommand: (command: DeviceCommand) => Promise<void>;
  /** False while the dashboard is being edited, so a tap selects instead of changing the device. */
  interactive?: boolean;
  onOpenControls?: () => void;
  onOpenHistory?: () => void;
  /** What a press and hold does; null for nothing, undefined for the tile's own default. */
  onHold?: (() => void) | null;
}

export function DeviceTile({ device, onOpenControls, onOpenHistory, onHold, ...props }: DeviceTileProps) {
  if (device.kind === "light" || device.kind === "switch" || device.kind === "fan") return <ToggleTile device={device} onOpenControls={onOpenControls} onHold={onHold} {...props} />;
  return <StateTile device={device} onOpenHistory={onOpenHistory} onHold={onHold} {...props} />;
}
