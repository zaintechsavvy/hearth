import type { AlarmDevice, ArmMode, Device, DeviceCommand } from "@/lib/devices/types";

export interface BedtimeStep {
  deviceId: string;
  name: string;
  /** What it did, after the name, once it worked: "locked", "turned off". */
  done: string;
  command: DeviceCommand | null;
  /** Why it cannot run here, such as an alarm that needs its code. */
  skip?: string;
}

export interface BedtimeResult {
  done: { name: string; what: string }[];
  failed: { name: string; why: string }[];
}

const SHUT_COVERS = new Set(["garage", "gate", "door"]);
const ARM_ORDER: ArmMode[] = ["night", "home", "away"];

const armMode = (alarm: AlarmDevice) => ARM_ORDER.find(mode => alarm.modes.includes(mode)) ?? alarm.modes[0];

/**
 * What a bedtime check does to this home: locks what is unlocked, closes garage doors, gates, and doors, turns off
 * lights that are on, and arms a disarmed alarm for the night. Every step closes the home, so none needs a confirm.
 */
export function bedtimeSteps(devices: Device[]): BedtimeStep[] {
  const steps: BedtimeStep[] = [];
  for (const device of devices) {
    if (!device.available || device.auxiliary) continue;
    if (device.kind === "lock" && device.state !== "locked" && device.state !== "locking") steps.push({ deviceId: device.id, name: device.name, done: "locked", command: { type: "lock", locked: true } });
    if (device.kind === "cover" && SHUT_COVERS.has(device.coverClass) && device.state !== "closed" && device.state !== "closing") steps.push({ deviceId: device.id, name: device.name, done: "closed", command: { type: "cover", action: "close" } });
    if (device.kind === "light" && device.on) steps.push({ deviceId: device.id, name: device.name, done: "turned off", command: { type: "power", on: false } });
    if (device.kind === "alarm" && device.state === "disarmed" && device.modes.length) {
      const mode = armMode(device);
      steps.push(device.codeToArm
        ? { deviceId: device.id, name: device.name, done: "armed", command: null, skip: "needs its code, so arm it from its tile" }
        : { deviceId: device.id, name: device.name, done: `armed for ${mode === "night" ? "the night" : mode}`, command: { type: "alarm", action: "arm", mode } });
    }
  }
  return steps;
}
