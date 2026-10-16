import type { Device } from "@/lib/devices/types";

const OPENINGS = new Set(["door", "window", "garage", "opening"]);
const SHUT_COVERS = new Set(["garage", "gate", "door"]);

/** Doors, windows, and garage doors that are open now: sensors reading open, and garage doors, gates, and doors not shut. */
export function openThings(devices: Device[]) {
  return devices.filter(device => device.available && !device.auxiliary && (
    (device.kind === "binary_sensor" && OPENINGS.has(device.sensorClass) && device.active)
    || (device.kind === "cover" && SHUT_COVERS.has(device.coverClass) && device.state !== "closed" && device.state !== "closing")
  ));
}

/** Whether it is dark out: between sunset and sunrise where the home's location is known, otherwise the wall's night window. */
export function isDark(now: Date, sun: { sunrise: string; sunset: string } | null, nightWindow: boolean) {
  if (!sun) return nightWindow;
  return now.getTime() < Date.parse(sun.sunrise) || now.getTime() > Date.parse(sun.sunset);
}
