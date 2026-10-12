"use client";

import type { TileConfig } from "@/lib/dashboard/layout";
import type { CameraDevice, Device, DeviceCommand, ThermostatDevice } from "@/lib/devices/types";
import { StateTile } from "./state-tile";
import { ToggleTile } from "./toggle-tile";

export type TileDevice = Exclude<Device, ThermostatDevice | CameraDevice>;

interface DeviceTileProps {
  device: TileDevice;
  config: TileConfig;
  onCommand: (command: DeviceCommand) => Promise<void>;
  /** False while the dashboard is being edited, so a tap selects instead of changing the device. */
  interactive?: boolean;
}

export function DeviceTile({ device, ...props }: DeviceTileProps) {
  if (device.kind === "light" || device.kind === "switch" || device.kind === "fan") return <ToggleTile device={device} {...props} />;
  return <StateTile device={device} {...props} />;
}
