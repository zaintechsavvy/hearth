import type { Device } from "@/lib/devices/types";
import type { WallSettings } from "@/lib/wall";

/** Which changes may take over a wall tablet's screen: all of them, only the chosen devices, or none. */
export type MomentMode = "all" | "chosen" | "off";

export const momentModeOf = (value: unknown): MomentMode => value === "chosen" || value === "off" ? value : "all";

const ENTRY_COVERS = new Set(["garage", "gate", "door"]);
const OPENINGS = new Set(["door", "window", "garage", "opening"]);

/**
 * What a device's full-screen moment shows, or null for a device that never takes the screen. A leak alarm is not
 * listed: it always shows, whatever is chosen.
 */
export function momentKind(device: Device): "light" | "fan" | "lock" | "garage" | "door" | "window" | null {
  if (device.kind === "light" || device.kind === "fan" || device.kind === "lock") return device.kind;
  if (device.kind === "cover" && ENTRY_COVERS.has(device.coverClass)) return device.coverClass === "garage" ? "garage" : "door";
  if (device.kind === "binary_sensor" && OPENINGS.has(device.sensorClass)) return device.sensorClass === "garage" ? "garage" : device.sensorClass === "window" ? "window" : "door";
  return null;
}

type MomentSettings = Pick<WallSettings, "moments" | "momentDevices" | "momentsResting">;

/** Whether a change on `deviceId` may take over the screen, given whether the screen is resting. */
export function momentAllowed(settings: MomentSettings, deviceId: string, resting: boolean) {
  const mode = momentModeOf(settings.moments);
  if (mode === "off" || (resting && !settings.momentsResting)) return false;
  return mode === "all" || settings.momentDevices.includes(deviceId);
}

/** The devices first ticked when someone limits moments: the ways into the home, not every light. */
export const entryMoments = (devices: Device[]) => devices.filter(device => { const kind = momentKind(device); return kind !== null && kind !== "light" && kind !== "fan"; }).map(device => device.id);
