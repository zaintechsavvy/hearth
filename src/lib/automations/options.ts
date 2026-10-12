import { isSensitive, type Device, type DeviceCommand } from "@/lib/devices/types";
import type { StateMatch } from "./types";

export interface MatchOption {
  key: string;
  label: string;
  match: StateMatch;
}

const ENTRY = new Set(["door", "window", "garage", "opening"]);

/** The states worth starting a rule on, for one device. */
export function matchOptions(device: Device): MatchOption[] {
  const plain = (is: Exclude<StateMatch["is"], "above" | "below">, label: string): MatchOption => ({ key: is, label, match: { is } });
  const offline = plain("offline", "goes offline");
  switch (device.kind) {
    case "light":
    case "switch":
    case "fan":
      return [plain("on", "turns on"), plain("off", "turns off"), offline];
    case "lock":
      return [plain("unlocked", "unlocks"), plain("locked", "locks"), offline];
    case "cover":
      return [plain("open", "opens"), plain("closed", "closes"), offline];
    case "binary_sensor":
      return ENTRY.has(device.sensorClass)
        ? [plain("open", "opens"), plain("closed", "closes"), offline]
        : [plain("active", device.sensorClass === "leak" ? "detects a leak" : device.sensorClass === "smoke" ? "detects smoke" : "is triggered"), plain("clear", "clears"), offline];
    case "event":
      return [plain("rang", device.eventClass === "doorbell" ? "rings" : "is pressed")];
    case "sensor":
    case "thermostat":
      return [{ key: "above", label: "goes above", match: { is: "above", value: 25 } }, { key: "below", label: "goes below", match: { is: "below", value: 18 } }, offline];
    default:
      return [offline];
  }
}

export interface CommandOption {
  key: string;
  label: string;
  command: DeviceCommand;
  /** Takes a number from the person, such as a brightness. */
  value?: { min: number; max: number; step: number; unit: string; apply: (value: number) => DeviceCommand };
}

/** What a rule may tell one device to do. Anything that opens the home is left out. */
export function commandOptions(device: Device): CommandOption[] {
  const options: CommandOption[] = [];
  const add = (option: CommandOption) => { if (!isSensitive(device, option.command)) options.push(option); };
  switch (device.kind) {
    case "light":
      add({ key: "on", label: "Turn on", command: { type: "power", on: true } });
      add({ key: "off", label: "Turn off", command: { type: "power", on: false } });
      if (device.dimmable) add({ key: "brightness", label: "Set brightness", command: { type: "brightness", value: 50 }, value: { min: 1, max: 100, step: 1, unit: "%", apply: value => ({ type: "brightness", value }) } });
      if (device.temperatureRange) {
        const { min, max } = device.temperatureRange;
        add({ key: "white", label: "Set white", command: { type: "temperature", kelvin: Math.round((min + max) / 2) }, value: { min, max, step: 100, unit: " K", apply: kelvin => ({ type: "temperature", kelvin }) } });
      }
      break;
    case "switch":
      add({ key: "on", label: "Turn on", command: { type: "power", on: true } });
      add({ key: "off", label: "Turn off", command: { type: "power", on: false } });
      break;
    case "fan":
      add({ key: "on", label: "Turn on", command: { type: "power", on: true } });
      add({ key: "off", label: "Turn off", command: { type: "power", on: false } });
      if (device.adjustable) add({ key: "speed", label: "Set speed", command: { type: "fanSpeed", value: 50 }, value: { min: 1, max: 100, step: 1, unit: "%", apply: value => ({ type: "fanSpeed", value }) } });
      break;
    case "lock":
      add({ key: "lock", label: "Lock", command: { type: "lock", locked: true } });
      break;
    case "cover":
      add({ key: "close", label: "Close", command: { type: "cover", action: "close" } });
      add({ key: "open", label: "Open", command: { type: "cover", action: "open" } });
      if (device.canSetPosition) add({ key: "position", label: "Set position", command: { type: "coverPosition", value: 50 }, value: { min: 0, max: 100, step: 5, unit: "% open", apply: value => ({ type: "coverPosition", value }) } });
      break;
    case "thermostat":
      for (const mode of device.modes) add({ key: `mode-${mode}`, label: mode === "off" ? "Turn off" : `Set to ${mode}`, command: { type: "thermostatMode", mode } });
      add({ key: "target", label: "Set temperature", command: { type: "targetTemperature", value: device.target ?? 21 }, value: { min: device.min, max: device.max, step: device.step, unit: `°${device.unit}`, apply: value => ({ type: "targetTemperature", value }) } });
      break;
    case "scene":
      add({ key: "run", label: "Run", command: { type: "activate" } });
      break;
  }
  return options;
}

/** Which option a saved command belongs to, so the editor shows it chosen. */
export function commandKey(options: CommandOption[], command: DeviceCommand) {
  return options.find(option => option.command.type === command.type && (option.value || JSON.stringify(option.command) === JSON.stringify(command)))?.key ?? options[0]?.key;
}
