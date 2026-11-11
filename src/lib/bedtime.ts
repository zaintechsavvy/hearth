import type { AlarmDevice, ArmMode, Device, DeviceCommand } from "@/lib/devices/types";

/** Do it, only report it when it is not already so, or leave it alone. */
export type BedtimeChoice = "do" | "check" | "skip";

export interface BedtimeSettings {
  locks: BedtimeChoice;
  /** Garage doors, gates, and motorised doors. */
  doors: BedtimeChoice;
  lights: Exclude<BedtimeChoice, "check">;
  alarm: BedtimeChoice;
  /** Door and window sensors, which can only be checked. */
  openings: Exclude<BedtimeChoice, "do">;
  /** Lights and switches turned on for the night, such as a porch light. */
  turnOn: string[];
  /** Switches and fans turned off as well as the lights. */
  turnOff: string[];
  /** Devices the check never touches or reports. */
  keep: string[];
}

/** A new home's good night does nothing until someone picks what it should lock, close, or turn off. */
export const DEFAULT_BEDTIME: BedtimeSettings = { locks: "skip", doors: "skip", lights: "skip", alarm: "skip", openings: "skip", turnOn: [], turnOff: [], keep: [] };

/** What good night did before it started empty, offered as a one-tap starting point in Settings. */
export const SUGGESTED_BEDTIME: BedtimeSettings = { locks: "do", doors: "do", lights: "do", alarm: "do", openings: "check", turnOn: [], turnOff: [], keep: [] };

/** Whether good night has been given anything to do yet. */
export const bedtimeChosen = (settings: BedtimeSettings) =>
  settings.locks !== "skip" || settings.doors !== "skip" || settings.lights !== "skip" || settings.alarm !== "skip" || settings.openings !== "skip" || settings.turnOn.length > 0 || settings.turnOff.length > 0;

export interface BedtimeStep {
  deviceId: string;
  name: string;
  kind: Device["kind"];
  /** What it did, after the name, once it worked: "locked", "turned off". */
  done: string;
  /** Null when there is nothing to send: a check that found something, or an alarm that needs its code. */
  command: DeviceCommand | null;
  /** Why it needs a look instead, after the name: "is unlocked". */
  skip?: string;
}

export interface BedtimeResult {
  done: { name: string; what: string }[];
  failed: { name: string; why: string }[];
}

const SHUT_COVERS = new Set(["garage", "gate", "door"]);
const OPENINGS = new Set(["door", "window", "garage", "opening"]);
const ARM_ORDER: ArmMode[] = ["night", "home", "away"];
const SWITCHED = new Set(["light", "switch", "fan"]);

const armMode = (alarm: AlarmDevice) => ARM_ORDER.find(mode => alarm.modes.includes(mode)) ?? alarm.modes[0];

/** Devices that can be turned on or off for the night, for the settings lists. */
export const switchedForBedtime = (devices: Device[]) => devices.filter(device => SWITCHED.has(device.kind) && !device.auxiliary);

/**
 * What a good night check does to this home with these settings: locks what is unlocked, closes garage doors and gates,
 * turns off lights, arms a disarmed alarm for the night, and switches the chosen devices. A "check" only reports what
 * is not already so, and kept devices are left out entirely.
 */
export function bedtimeSteps(devices: Device[], settings: BedtimeSettings = DEFAULT_BEDTIME): BedtimeStep[] {
  const keep = new Set(settings.keep);
  const turnOn = new Set(settings.turnOn);
  const turnOff = new Set(settings.turnOff);
  const steps: BedtimeStep[] = [];
  const step = (device: Device, choice: BedtimeChoice, done: string, problem: string, command: DeviceCommand) => {
    if (choice === "skip") return;
    steps.push(choice === "do" ? { deviceId: device.id, name: device.name, kind: device.kind, done, command } : { deviceId: device.id, name: device.name, kind: device.kind, done, command: null, skip: problem });
  };
  for (const device of devices) {
    if (!device.available || device.auxiliary || keep.has(device.id)) continue;
    if (device.kind === "lock" && device.state !== "locked" && device.state !== "locking") step(device, settings.locks, "locked", "is unlocked", { type: "lock", locked: true });
    if (device.kind === "cover" && SHUT_COVERS.has(device.coverClass) && device.state !== "closed" && device.state !== "closing") step(device, settings.doors, "closed", "is open", { type: "cover", action: "close" });
    if (device.kind === "binary_sensor" && OPENINGS.has(device.sensorClass) && device.active && settings.openings === "check") steps.push({ deviceId: device.id, name: device.name, kind: device.kind, done: "", command: null, skip: "is open" });
    if (device.kind === "alarm" && device.state === "disarmed" && device.modes.length && settings.alarm !== "skip") {
      const mode = armMode(device);
      const alarm = { deviceId: device.id, name: device.name, kind: device.kind };
      if (settings.alarm === "check") steps.push({ ...alarm, done: "", command: null, skip: "is not armed" });
      else steps.push(device.codeToArm
        ? { ...alarm, done: "armed", command: null, skip: "needs its code, so arm it from its tile" }
        : { ...alarm, done: `armed for ${mode === "night" ? "the night" : mode}`, command: { type: "alarm", action: "arm", mode } });
    }
    if (!SWITCHED.has(device.kind) || !("on" in device)) continue;
    if (turnOn.has(device.id)) {
      if (!device.on) steps.push({ deviceId: device.id, name: device.name, kind: device.kind, done: "turned on", command: { type: "power", on: true } });
    } else if (device.on && (turnOff.has(device.id) || (device.kind === "light" && settings.lights === "do"))) {
      steps.push({ deviceId: device.id, name: device.name, kind: device.kind, done: "turned off", command: { type: "power", on: false } });
    }
  }
  return steps;
}

/** A short sentence of what the check is about to do, for the confirmation. */
export function bedtimePlan(steps: BedtimeStep[]) {
  const doing = steps.filter(item => item.command);
  const named = (verb: string, done: string, plural: string) => {
    const matching = doing.filter(item => item.done === done);
    const words = done === "turned off" && matching.every(item => item.kind === "light") ? "lights" : plural;
    return matching.length === 0 ? null : `${verb} ${matching.length === 1 ? matching[0].name : `${matching.length} ${words}`}`;
  };
  const parts = [
    named("lock", "locked", "doors"),
    named("close", "closed", "doors"),
    named("turn off", "turned off", "lights and switches"),
    named("turn on", "turned on", "devices"),
    doing.some(item => item.done.startsWith("armed")) ? "arm the alarm" : null,
  ].filter((part): part is string => part !== null);
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
  return `${list[0].toUpperCase()}${list.slice(1)}.`;
}
