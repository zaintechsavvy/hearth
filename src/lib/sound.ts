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

let chimeContext: AudioContext | null = null;

/** One bell tone: the note with a soft octave and a faint inharmonic shimmer, struck and left to ring out. */
function strike(context: AudioContext, out: AudioNode, hz: number, at: number, ring: number) {
  for (const [ratio, level, decay] of [[1, 1, 1], [2, .22, .5], [2.76, .07, .3]] as const) {
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.type = "sine";
    tone.frequency.value = hz * ratio;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ring * decay);
    tone.connect(gain).connect(out);
    tone.start(at);
    tone.stop(at + ring * decay + 0.05);
  }
}

/** The doorbell's chime: a soft, bright ding-dong, E6 then C6, synthesised live. Silent when sounds are off. */
export function chime(volume = 0.7) {
  if (typeof window === "undefined" || !soundsOn()) return;
  chimeContext ??= new AudioContext();
  const context = chimeContext;
  void context.resume().then(() => {
    const out = context.createGain();
    const soften = context.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 5_000;
    out.gain.value = 0.32 * volume;
    out.connect(soften).connect(context.destination);
    const now = context.currentTime + 0.02;
    strike(context, out, 1318.51, now, 1.2);
    strike(context, out, 1046.5, now + 0.38, 1.5);
  }).catch(() => {});
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
