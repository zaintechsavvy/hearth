import type { Device } from "@/lib/devices/types";

export function describeState(device: Device) {
  if (!device.available) return "unavailable";
  switch (device.kind) {
    case "light":
      return device.on ? (device.dimmable ? `on at ${device.brightness}%` : "on") : "off";
    case "fan":
      return device.on ? (device.adjustable ? `on at ${device.speed}%` : "on") : "off";
    case "switch":
      return device.on ? "on" : "off";
    case "thermostat":
      return `mode ${device.mode}, target ${device.target ?? "unknown"}°${device.unit}, inside ${device.current ?? "unknown"}°${device.unit}, modes ${device.modes.join("/")}, range ${device.min} to ${device.max}`;
  }
}
