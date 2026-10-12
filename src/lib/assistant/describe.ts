import { hsToHex } from "@/lib/devices/color";
import type { Device } from "@/lib/devices/types";

export function describeState(device: Device) {
  if (!device.available) return "unavailable";
  switch (device.kind) {
    case "light": {
      const state = device.on ? (device.dimmable ? `on at ${device.brightness}%` : "on") : "off";
      const color = device.supportsColor ? `, takes colour${device.on && device.colorMode === "color" && device.color ? ` (now ${hsToHex(device.color)})` : ""}` : "";
      const white = device.temperatureRange ? `, white ${device.temperatureRange.min} to ${device.temperatureRange.max} K${device.on && device.colorMode === "white" && device.temperature ? ` (now ${device.temperature} K)` : ""}` : "";
      return `${state}${color}${white}`;
    }
    case "fan":
      return device.on ? (device.adjustable ? `on at ${device.speed}%` : "on") : "off";
    case "switch":
      return device.on ? "on" : "off";
    case "thermostat":
      return `mode ${device.mode}, target ${device.target ?? "unknown"}°${device.unit}, inside ${device.current ?? "unknown"}°${device.unit}, modes ${device.modes.join("/")}, range ${device.min} to ${device.max}`;
    case "lock":
      return device.state;
    case "cover":
      return `${device.coverClass}, ${device.state}${device.position !== null ? `, ${device.position}% open` : ""}${device.canSetPosition ? ", accepts a position" : ""}`;
    case "binary_sensor":
      return `${device.sensorClass} sensor, ${device.active ? "triggered" : "clear"} (read only)`;
    case "sensor":
      return `${device.sensorClass} ${device.value ?? "unknown"}${device.unit ?? ""} (read only)`;
    case "event":
      return `${device.eventClass}, last ${device.last ?? "never"} (read only)`;
    case "camera":
      return "camera (read only)";
    case "scene":
      return `${device.variant}, run with activate`;
  }
}
