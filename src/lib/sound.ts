import { play, type PlayOptions, type SoundName } from "cuelume";
import type { Device, DeviceCommand } from "@/lib/devices/types";

/** This device's choice, stored as JSON; anything but false keeps sounds on. */
export const SOUNDS_KEY = "hearth-sounds";

export const soundsOn = () => typeof localStorage !== "undefined" && localStorage.getItem(SOUNDS_KEY) !== "false";

/** A short interface sound, synthesised live by cuelume. Silent when this device has sounds off. */
export function cue(name: SoundName, options?: PlayOptions) {
  if (typeof window === "undefined" || !soundsOn()) return;
  play(name, { volume: 0.45, ...options });
}

type Cue = [SoundName, PlayOptions?];

const way = (forward: boolean): PlayOptions => ({ direction: forward ? "forward" : "back" });

/**
 * The sound for a change someone makes from a tile. Almost everything is the woody select, rising for on and falling for
 * off; opening the home up, an unlock or a garage, door or gate opening, gets the soft swell instead. Continuous
 * controls (a brightness or volume drag, a seek), track skips and the thermostat's target stay silent here: the
 * thermostat sounds as its arrows are pressed, not when the new target is sent.
 */
export function commandCue(device: Device, command: DeviceCommand): Cue | null {
  const gate = device.kind === "cover" && ["garage", "door", "gate"].includes(device.coverClass);
  switch (command.type) {
    case "power":
    case "shuffle":
      return ["select", way(command.on)];
    case "lock":
      return command.locked ? ["select", way(true)] : ["loading"];
    case "alarm":
      return ["select", way(command.action === "arm")];
    case "cover":
      if (command.action === "stop") return ["select"];
      return command.action === "open" && gate ? ["loading"] : ["select", way(command.action === "open")];
    case "media":
      return command.action === "play" || command.action === "pause" ? ["select", way(command.action === "play")] : null;
    case "thermostatMode":
    case "thermostatPreset":
    case "thermostatFan":
    case "vacuumFanSpeed":
    case "output":
    case "repeat":
    case "join":
    case "unjoin":
    case "vacuumAreas":
    case "activate":
    case "playMedia":
    case "announce":
      return ["select"];
    case "vacuum":
      if (command.action === "start" || command.action === "spot") return ["loading"];
      return ["select", way(command.action === "locate")];
    case "todo":
      return ["select", way(command.action !== "uncheck" && command.action !== "remove")];
    default:
      return null;
  }
}
