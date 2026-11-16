import { play, type PlayOptions, type SoundName } from "cuelume";
import type { Device, DeviceCommand } from "@/lib/devices/types";

/** This device's choice, stored as JSON; anything but false keeps sounds on. */
export const SOUNDS_KEY = "hearth-sounds";

export const soundsOn = () => typeof localStorage !== "undefined" && localStorage.getItem(SOUNDS_KEY) !== "false";

/** A short interface sound, synthesised live by cuelume. Silent when this device has sounds off. */
export function cue(name: SoundName, options?: PlayOptions) {
  if (typeof window === "undefined" || !soundsOn()) return;
  play(name, { volume: 0.7, ...options });
}

type Cue = [SoundName, PlayOptions?];

/**
 * The sound for a change someone makes from a tile. Continuous controls, a brightness or volume drag, a seek, stay
 * silent: they send in bursts, and a sound per step wears out.
 */
export function commandCue(device: Device, command: DeviceCommand): Cue | null {
  switch (command.type) {
    case "power":
    case "shuffle":
      return ["toggle", { direction: command.on ? "forward" : "back" }];
    case "lock":
      return ["toggle", { direction: command.locked ? "forward" : "back", emphasis: command.locked ? "strong" : "normal" }];
    case "alarm":
      return ["toggle", { direction: command.action === "arm" ? "forward" : "back", emphasis: command.action === "arm" ? "strong" : "normal" }];
    case "cover":
      return command.action === "stop" ? ["tap"] : [command.action, { emphasis: ["garage", "door", "gate"].includes(device.kind === "cover" ? device.coverClass : "") ? "normal" : "subtle" }];
    case "media":
      if (command.action === "next" || command.action === "previous") return ["navigate", { direction: command.action === "next" ? "forward" : "back", emphasis: "subtle" }];
      return ["toggle", { direction: command.action === "play" ? "forward" : "back" }];
    case "targetTemperature":
      return ["select", { emphasis: "subtle", direction: device.kind === "thermostat" && device.target !== null && command.value < device.target ? "back" : "forward" }];
    case "thermostatMode":
    case "thermostatPreset":
    case "thermostatFan":
    case "vacuumFanSpeed":
    case "output":
    case "repeat":
    case "join":
    case "unjoin":
    case "vacuumAreas":
      return ["select"];
    case "vacuum":
      if (command.action === "start" || command.action === "spot") return ["loading"];
      if (command.action === "dock" || command.action === "stop") return ["close"];
      return ["tap"];
    case "todo":
      if (command.action === "check" || command.action === "uncheck") return ["toggle", { direction: command.action === "check" ? "forward" : "back" }];
      return command.action === "remove" ? ["close", { emphasis: "subtle" }] : ["tap"];
    case "activate":
    case "playMedia":
    case "announce":
      return ["tap"];
    default:
      return null;
  }
}
