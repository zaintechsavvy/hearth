import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";

export interface SceneAction {
  deviceId: string;
  command: DeviceCommand;
}

export interface HearthScene {
  id: string;
  name: string;
  icon: string | null;
  actions: SceneAction[];
}

export const sceneTileId = (sceneId: string) => `scene:${sceneId}`;

/** The commands that recreate a device's current state, or none for devices a scene cannot set. */
export function captureState(device: Device): DeviceCommand[] {
  switch (device.kind) {
    case "light":
      return device.on && device.dimmable ? [{ type: "brightness", value: device.brightness }] : [{ type: "power", on: device.on }];
    case "fan":
      return device.on && device.adjustable ? [{ type: "fanSpeed", value: device.speed }] : [{ type: "power", on: device.on }];
    case "switch":
      return [{ type: "power", on: device.on }];
    case "thermostat":
      return device.mode === "off" || device.target === null ? [{ type: "thermostatMode", mode: device.mode }] : [{ type: "thermostatMode", mode: device.mode }, { type: "targetTemperature", value: device.target }];
    case "lock":
      return [{ type: "lock", locked: true }];
    case "cover": {
      const entry = device.coverClass === "garage" || device.coverClass === "door" || device.coverClass === "gate";
      return !entry && device.canSetPosition && device.position !== null ? [{ type: "coverPosition", value: device.position }] : [{ type: "cover", action: "close" }];
    }
    default:
      return [];
  }
}

/** Devices a scene can include. Locks always lock and doors always close, so a scene cannot open the home. */
export const sceneable = (device: Device) => device.available && captureState(device).length > 0;

export function describeAction(device: Device, command: DeviceCommand) {
  switch (command.type) {
    case "power":
      return command.on ? "On" : "Off";
    case "brightness":
      return `${command.value}%`;
    case "fanSpeed":
      return `Speed ${command.value}%`;
    case "targetTemperature":
      return `${command.value}°${device.kind === "thermostat" ? device.unit : ""}`;
    case "thermostatMode":
      return command.mode[0].toUpperCase() + command.mode.slice(1);
    case "lock":
      return command.locked ? "Lock" : "Unlock";
    case "cover":
      return command.action === "close" ? "Close" : command.action === "open" ? "Open" : "Stop";
    case "coverPosition":
      return `${command.value}% open`;
    case "activate":
      return "Run";
  }
}

/** What the home would look like after the scene, for optimistic updates. */
export function applyScene(devices: Device[], actions: SceneAction[]) {
  const byId = new Map(devices.map(device => [device.id, device]));
  for (const action of actions) {
    const device = byId.get(action.deviceId);
    if (device) byId.set(device.id, applyCommand(device, action.command));
  }
  return devices.map(device => byId.get(device.id) ?? device);
}
