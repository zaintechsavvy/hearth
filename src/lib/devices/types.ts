import type { HueSaturation } from "./color";

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
  /** What the integration calls it, when the name was changed in Hearth. */
  sourceName?: string;
  /** The integration's room, when the room was changed in Hearth. */
  sourceRoom?: string | null;
}

export interface LightDevice extends DeviceBase {
  kind: "light";
  on: boolean;
  dimmable: boolean;
  /** 0 to 100. */
  brightness: number;
  supportsColor: boolean;
  /** The current colour, when the light reports one. */
  color: HueSaturation | null;
  /** Whether it is showing a colour or a shade of white, when it can do either. */
  colorMode: "color" | "white" | null;
  /** The white temperatures it accepts, in kelvin; null when it has no white control. */
  temperatureRange: { min: number; max: number } | null;
  /** The current white temperature in kelvin, when it reports one. */
  temperature: number | null;
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

export type MediaState = "playing" | "paused" | "idle" | "off";
export type RepeatMode = "off" | "all" | "one";

export interface MediaPlayerDevice extends DeviceBase {
  kind: "media_player";
  state: MediaState;
  title: string | null;
  artist: string | null;
  /** An address the browser can load the cover from, which changes with the track. */
  artwork: string | null;
  /** Seconds into the track at `positionAt`; the browser runs the clock forward while it plays. */
  position: number | null;
  positionAt: string | null;
  duration: number | null;
  /** 0 to 100, or null when the player has no volume. */
  volume: number | null;
  /** Where it can play: speakers, Bluetooth devices, or a receiver's inputs, as the integration names them. */
  outputs: string[];
  output: string | null;
  shuffle: boolean | null;
  repeat: RepeatMode | null;
  /** Players playing together, leader first, as device ids; empty when it plays alone. */
  group: string[];
  /** What is playing, as the player can be asked to play it again. */
  media: { id: string; type: string } | null;
  can: {
    pause: boolean; seek: boolean; next: boolean; previous: boolean; volume: boolean; output: boolean;
    shuffle: boolean; repeat: boolean; group: boolean; play: boolean;
    /** It can say what plays next, as Music Assistant players can. */
    queue: boolean;
  };
}

export interface PersonDevice extends DeviceBase {
  kind: "person";
  home: boolean;
  /** The zone they are in when away, such as Work; null when the zone is unknown. */
  place: string | null;
  /** An address the browser can load their picture from. */
  picture: string | null;
  /** When they arrived or left. */
  since: string | null;
  /** Their phone's battery, when its tracker reports one. */
  battery: number | null;
}

export type VacuumState = "cleaning" | "docked" | "returning" | "paused" | "idle" | "error";

export interface VacuumDevice extends DeviceBase {
  kind: "vacuum";
  state: VacuumState;
  battery: number | null;
  can: { start: boolean; pause: boolean; stop: boolean; dock: boolean; locate: boolean };
}

export type AlarmState = "disarmed" | "armed_home" | "armed_away" | "armed_night" | "armed_vacation" | "arming" | "pending" | "triggered" | "disarming";
export type ArmMode = "home" | "away" | "night" | "vacation";

export interface AlarmDevice extends DeviceBase {
  kind: "alarm";
  state: AlarmState;
  modes: ArmMode[];
  /** The alarm's own code: digits, any text, or none needed. */
  codeFormat: "number" | "text" | null;
  /** Whether arming asks for the code too, not only disarming. */
  codeToArm: boolean;
}

export interface TodoDevice extends DeviceBase {
  kind: "todo";
  /** Items not checked off yet. */
  open: number;
  can: { add: boolean; remove: boolean; check: boolean };
}

export interface TodoItem {
  uid: string;
  summary: string;
  done: boolean;
}

export type Device =
  | LightDevice | SwitchDevice | FanDevice | ThermostatDevice
  | LockDevice | CoverDevice | BinarySensorDevice | SensorDevice | CameraDevice | EventDevice | SceneDevice | MediaPlayerDevice
  | PersonDevice | VacuumDevice | AlarmDevice | TodoDevice;
export type DeviceKind = Device["kind"];

export type DeviceCommand =
  | { type: "power"; on: boolean }
  | { type: "brightness"; value: number }
  | { type: "color"; hue: number; saturation: number }
  | { type: "temperature"; kelvin: number }
  | { type: "fanSpeed"; value: number }
  | { type: "targetTemperature"; value: number }
  | { type: "thermostatMode"; mode: ThermostatMode }
  | { type: "lock"; locked: boolean }
  | { type: "cover"; action: "open" | "close" | "stop" }
  | { type: "coverPosition"; value: number }
  | { type: "activate" }
  | { type: "media"; action: "play" | "pause" | "next" | "previous" }
  | { type: "seek"; position: number }
  | { type: "volume"; value: number }
  | { type: "output"; output: string }
  | { type: "shuffle"; on: boolean }
  | { type: "repeat"; mode: RepeatMode }
  /** Adds players to this one's group; `members` are device ids. */
  | { type: "join"; members: string[] }
  | { type: "unjoin" }
  | { type: "playMedia"; id: string; mediaType: string }
  | { type: "announce"; message: string }
  | { type: "vacuum"; action: "start" | "pause" | "stop" | "dock" | "locate" }
  /** `code` is the alarm's own code, when it has one. */
  | { type: "alarm"; action: "arm" | "disarm"; mode?: ArmMode; code?: string }
  /** `item` is the item's uid, or the text of a new one. */
  | { type: "todo"; action: "add" | "check" | "uncheck" | "remove"; item: string };

/** Changes that open the home up. The UI confirms them, and the assistant leaves them to a person. */
export function isSensitive(device: Device, command: DeviceCommand) {
  if (command.type === "lock") return !command.locked;
  if (command.type === "alarm") return command.action === "disarm";
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
    case "color":
      return device.kind === "light" ? { ...device, on: true, color: { hue: command.hue, saturation: command.saturation }, colorMode: "color" } : device;
    case "temperature":
      return device.kind === "light" && device.temperatureRange
        ? { ...device, on: true, temperature: clamp(command.kelvin, device.temperatureRange.min, device.temperatureRange.max), colorMode: "white" }
        : device;
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
    case "media":
      if (device.kind !== "media_player" || command.action === "next" || command.action === "previous") return device;
      return { ...device, state: command.action === "play" ? "playing" : "paused", position: livePosition(device), positionAt: new Date().toISOString() };
    case "seek":
      return device.kind === "media_player" ? { ...device, position: command.position, positionAt: new Date().toISOString() } : device;
    case "volume":
      return device.kind === "media_player" ? { ...device, volume: clamp(command.value, 0, 100) } : device;
    case "output":
      return device.kind === "media_player" ? { ...device, output: command.output } : device;
    case "shuffle":
      return device.kind === "media_player" ? { ...device, shuffle: command.on } : device;
    case "repeat":
      return device.kind === "media_player" ? { ...device, repeat: command.mode } : device;
    case "join":
      return device.kind === "media_player" ? { ...device, group: [...new Set([device.id, ...device.group, ...command.members])] } : device;
    case "unjoin":
      return device.kind === "media_player" ? { ...device, group: [] } : device;
    case "playMedia":
      return device.kind === "media_player" ? { ...device, state: "playing" } : device;
    case "announce":
      return device;
    case "vacuum":
      if (device.kind !== "vacuum") return device;
      return { ...device, state: ({ start: "cleaning", pause: "paused", stop: "idle", dock: "returning", locate: device.state } as const)[command.action] };
    case "alarm":
      if (device.kind !== "alarm") return device;
      return { ...device, state: command.action === "disarm" ? "disarmed" : command.mode === "away" || command.mode === "vacation" ? "arming" : `armed_${command.mode ?? "home"}` };
    case "todo":
      if (device.kind !== "todo") return device;
      return { ...device, open: Math.max(0, device.open + (command.action === "add" || command.action === "uncheck" ? 1 : command.action === "check" ? -1 : 0)) };
  }
}

/** Where a track is now, in seconds: the reported position plus the time it has been playing since. */
export function livePosition(device: MediaPlayerDevice, now = Date.now()) {
  if (device.position === null) return null;
  const elapsed = device.state === "playing" && device.positionAt ? Math.max(0, (now - Date.parse(device.positionAt)) / 1000) : 0;
  const at = device.position + elapsed;
  return device.duration ? Math.min(at, device.duration) : at;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
