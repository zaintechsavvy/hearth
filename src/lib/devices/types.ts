export type TemperatureUnit = "C" | "F";
export type ThermostatMode = "off" | "heat" | "cool" | "auto";
export type ThermostatAction = "heating" | "cooling" | "idle" | "off";

interface DeviceBase {
  /** `<integrationId>:<native id>`, stable across polls. */
  id: string;
  integrationId: string;
  name: string;
  available: boolean;
}

export interface LightDevice extends DeviceBase {
  kind: "light";
  on: boolean;
  dimmable: boolean;
  /** 0 to 100. */
  brightness: number;
}

export interface SwitchDevice extends DeviceBase {
  kind: "switch";
  on: boolean;
}

export interface FanDevice extends DeviceBase {
  kind: "fan";
  on: boolean;
  adjustable: boolean;
  /** 0 to 100. */
  speed: number;
}

export interface ThermostatDevice extends DeviceBase {
  kind: "thermostat";
  unit: TemperatureUnit;
  current: number | null;
  target: number | null;
  min: number;
  max: number;
  step: number;
  mode: ThermostatMode;
  modes: ThermostatMode[];
  action: ThermostatAction | null;
}

export type Device = LightDevice | SwitchDevice | FanDevice | ThermostatDevice;
export type DeviceKind = Device["kind"];

export type DeviceCommand =
  | { type: "power"; on: boolean }
  | { type: "brightness"; value: number }
  | { type: "fanSpeed"; value: number }
  | { type: "targetTemperature"; value: number }
  | { type: "thermostatMode"; mode: ThermostatMode };

export function deviceId(integrationId: string, nativeId: string) {
  return `${integrationId}:${nativeId}`;
}

export function parseDeviceId(id: string) {
  const split = id.indexOf(":");
  if (split < 1) return null;
  return { integrationId: id.slice(0, split), nativeId: id.slice(split + 1) };
}

/** The state a command should produce, used for optimistic UI and the demo home. */
export function applyCommand<T extends Device>(device: T, command: DeviceCommand): T {
  switch (command.type) {
    case "power":
      if (device.kind === "thermostat") return { ...device, mode: command.on ? device.modes.find(mode => mode !== "off") ?? "heat" : "off" };
      if (device.kind === "fan") return { ...device, on: command.on, speed: command.on ? device.speed || 100 : 0 };
      return { ...device, on: command.on };
    case "brightness":
      return device.kind === "light" ? { ...device, brightness: command.value, on: command.value > 0 } : device;
    case "fanSpeed":
      return device.kind === "fan" ? { ...device, speed: command.value, on: command.value > 0 } : device;
    case "targetTemperature":
      return device.kind === "thermostat" ? { ...device, target: clamp(command.value, device.min, device.max) } : device;
    case "thermostatMode":
      return device.kind === "thermostat" ? { ...device, mode: command.mode } : device;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
