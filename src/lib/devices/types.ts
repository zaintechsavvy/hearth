export type TemperatureUnit = "C" | "F";
export type ThermostatMode = "off" | "heat" | "cool" | "auto";
export type ThermostatAction = "heating" | "cooling" | "idle" | "off";

interface DeviceBase {
  /** `<integrationId>:<native id>`, stable across polls. */
  id: string;
  integrationId: string;
  name: string;
  /** The room or area, when the integration knows it. */
  room: string | null;
  available: boolean;
  /** A settings or diagnostic entity, or one hidden in its source, such as "Restart" or "Firmware". */
  auxiliary?: boolean;
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

export type LockState = "locked" | "unlocked" | "locking" | "unlocking" | "jammed" | "open" | "unknown";

export interface LockDevice extends DeviceBase {
  kind: "lock";
  state: LockState;
}

export type CoverClass = "garage" | "door" | "gate" | "blind" | "shade" | "curtain" | "window" | "other";
export type CoverState = "open" | "closed" | "opening" | "closing" | "stopped" | "unknown";

export interface CoverDevice extends DeviceBase {
  kind: "cover";
  coverClass: CoverClass;
  state: CoverState;
  /** 0 is closed, 100 is open; null when the device does not report it. */
  position: number | null;
  canStop: boolean;
  canSetPosition: boolean;
}

export type BinarySensorClass = "door" | "window" | "garage" | "opening" | "motion" | "occupancy" | "leak" | "smoke" | "other";

export interface BinarySensorDevice extends DeviceBase {
  kind: "binary_sensor";
  sensorClass: BinarySensorClass;
  /** Open, motion detected, leak detected, and so on. */
  active: boolean;
}

export type SensorClass = "temperature" | "humidity" | "battery" | "illuminance" | "power" | "energy" | "co2" | "pm25" | "other";

export interface SensorDevice extends DeviceBase {
  kind: "sensor";
  sensorClass: SensorClass;
  value: number | null;
  unit: string | null;
}

export interface CameraDevice extends DeviceBase {
  kind: "camera";
  /** False when the integration can see the camera but cannot relay its video, as with Matter cameras today. */
  streamable: boolean;
}

export type EventClass = "doorbell" | "button" | "motion" | "other";

export interface EventDevice extends DeviceBase {
  kind: "event";
  eventClass: EventClass;
  /** ISO time of the last event. */
  last: string | null;
}

export type SceneVariant = "scene" | "script" | "button";

export interface SceneDevice extends DeviceBase {
  kind: "scene";
  variant: SceneVariant;
}

export type Device =
  | LightDevice | SwitchDevice | FanDevice | ThermostatDevice
  | LockDevice | CoverDevice | BinarySensorDevice | SensorDevice | CameraDevice | EventDevice | SceneDevice;
export type DeviceKind = Device["kind"];

export type DeviceCommand =
  | { type: "power"; on: boolean }
  | { type: "brightness"; value: number }
  | { type: "fanSpeed"; value: number }
  | { type: "targetTemperature"; value: number }
  | { type: "thermostatMode"; mode: ThermostatMode }
  | { type: "lock"; locked: boolean }
  | { type: "cover"; action: "open" | "close" | "stop" }
  | { type: "coverPosition"; value: number }
  | { type: "activate" };

/** Changes that open the home up. The UI confirms them, and the assistant leaves them to a person. */
export function isSensitive(device: Device, command: DeviceCommand) {
  if (command.type === "lock") return !command.locked;
  if (device.kind !== "cover" || !["garage", "door", "gate"].includes(device.coverClass)) return false;
  return (command.type === "cover" && command.action === "open") || (command.type === "coverPosition" && command.value > 0);
}

const QUIET_SENSORS: SensorClass[] = ["battery", "power", "energy", "other"];

/** Whether a new device starts on the dashboard; the rest start hidden and can be shown from Edit. */
export function shownByDefault(device: Device) {
  if (device.auxiliary || !device.available) return false;
  switch (device.kind) {
    case "sensor":
      return !QUIET_SENSORS.includes(device.sensorClass);
    case "binary_sensor":
      return device.sensorClass !== "other";
    case "event":
      return device.eventClass === "doorbell";
    case "scene":
      return device.variant === "scene";
    default:
      return true;
  }
}

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
      if (device.kind !== "light" && device.kind !== "switch" && device.kind !== "fan" && device.kind !== "thermostat") return device;
      if (device.kind === "thermostat") return { ...device, mode: command.on ? device.modes.find(mode => mode !== "off") ?? "heat" : "off" };
      if (device.kind === "fan") return { ...device, on: command.on, speed: command.on ? device.speed || 100 : device.speed };
      return { ...device, on: command.on };
    case "brightness":
      return device.kind === "light" ? { ...device, brightness: command.value, on: command.value > 0 } : device;
    case "fanSpeed":
      return device.kind === "fan" ? { ...device, speed: command.value, on: command.value > 0 } : device;
    case "targetTemperature":
      return device.kind === "thermostat" ? { ...device, target: clamp(command.value, device.min, device.max) } : device;
    case "thermostatMode":
      return device.kind === "thermostat" ? { ...device, mode: command.mode } : device;
    case "lock":
      return device.kind === "lock" ? { ...device, state: command.locked ? "locked" : "unlocked" } : device;
    case "cover":
      if (device.kind !== "cover") return device;
      return { ...device, state: command.action === "open" ? "opening" : command.action === "close" ? "closing" : "stopped" };
    case "coverPosition":
      return device.kind === "cover" ? { ...device, position: clamp(command.value, 0, 100), state: command.value === 0 ? "closed" : "open" } : device;
    case "activate":
      return device;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
