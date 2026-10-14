"use client";

import type { TileConfig } from "@/lib/dashboard/layout";
import type { AlarmDevice, CameraDevice, Device, DeviceCommand, MediaPlayerDevice, PersonDevice, ThermostatDevice, TodoDevice, VacuumDevice } from "@/lib/devices/types";
import type { OpenMethod } from "@/lib/security-types";
import { StateTile } from "./state-tile";
import { ToggleTile } from "./toggle-tile";

export type TileDevice = Exclude<Device, ThermostatDevice | CameraDevice | MediaPlayerDevice | PersonDevice | VacuumDevice | AlarmDevice | TodoDevice>;

interface DeviceTileProps {
  device: TileDevice;
  config: TileConfig;
  onCommand: (command: DeviceCommand, pin?: string) => Promise<void>;
  openMethod?: OpenMethod;
  /** False while the dashboard is being edited, so a tap selects instead of changing the device. */
  interactive?: boolean;
  onOpenControls?: () => void;
  onOpenHistory?: () => void;
  /** What a press and hold does; null for nothing, undefined for the tile's own default. */
  onHold?: (() => void) | null;
}

export function DeviceTile({ device, onOpenControls, onOpenHistory, onHold, openMethod, ...props }: DeviceTileProps) {
  if (device.kind === "light" || device.kind === "switch" || device.kind === "fan") return <ToggleTile device={device} onOpenControls={onOpenControls} onHold={onHold} {...props} />;
  return <StateTile device={device} onOpenHistory={onOpenHistory} onHold={onHold} openMethod={openMethod} {...props} />;
}
