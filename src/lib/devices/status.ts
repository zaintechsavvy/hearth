import type { Device } from "./types";

const KIND_LABELS: Record<Device["kind"], string> = {
  light: "Light", switch: "Switch", fan: "Fan", thermostat: "Thermostat", lock: "Lock", cover: "Cover", binary_sensor: "Sensor",
  sensor: "Reading", camera: "Camera", event: "Button", scene: "Scene", media_player: "Music",
};

/** A short type name for lists, such as "Garage door" or "Temperature". */
export function kindLabel(device: Device) {
  switch (device.kind) {
    case "cover":
      return { garage: "Garage door", door: "Door", gate: "Gate", blind: "Blind", shade: "Shade", curtain: "Curtain", window: "Window", other: "Cover" }[device.coverClass];
    case "binary_sensor":
      return { door: "Door sensor", window: "Window sensor", garage: "Garage sensor", opening: "Opening sensor", motion: "Motion sensor", occupancy: "Presence sensor", leak: "Leak sensor", smoke: "Smoke sensor", other: "Sensor" }[device.sensorClass];
    case "sensor":
      return { temperature: "Temperature", humidity: "Humidity", battery: "Battery", illuminance: "Light level", power: "Power", energy: "Energy", co2: "CO2", pm25: "PM2.5", other: "Reading" }[device.sensorClass];
    case "event":
      return device.eventClass === "doorbell" ? "Doorbell" : "Button";
    case "scene":
      return device.variant === "script" ? "Script" : device.variant === "button" ? "Button" : "Scene";
    default:
      return KIND_LABELS[device.kind];
  }
}

/** The current state in a few words, for lists and summaries. */
export function statusText(device: Device): string {
  if (!device.available) return "Unavailable";
  switch (device.kind) {
    case "light":
      return device.on ? (device.dimmable ? `On · ${device.brightness}%` : "On") : "Off";
    case "fan":
      return device.on ? (device.adjustable ? `On · ${device.speed}%` : "On") : "Off";
    case "switch":
      return device.on ? "On" : "Off";
    case "thermostat":
      return device.mode === "off" ? "Off" : `${device.mode[0].toUpperCase()}${device.mode.slice(1)}${device.target !== null ? ` to ${device.target}°` : ""}${device.current !== null ? ` · ${device.current}° inside` : ""}`;
    case "lock":
      return device.state[0].toUpperCase() + device.state.slice(1);
    case "cover":
      return device.position !== null && device.position > 0 && device.position < 100 ? `${device.position}% open` : device.state[0].toUpperCase() + device.state.slice(1);
    case "binary_sensor":
      return device.sensorClass === "motion" || device.sensorClass === "occupancy" ? (device.active ? "Motion" : "Clear") : device.sensorClass === "leak" ? (device.active ? "Leak" : "Dry") : device.sensorClass === "smoke" ? (device.active ? "Smoke" : "Clear") : device.active ? "Open" : "Closed";
    case "sensor":
      return device.value === null ? "No reading" : `${Number.isInteger(device.value) ? device.value : device.value.toFixed(1)}${device.unit ? ` ${device.unit}` : ""}`;
    case "event":
      return device.last ? `Last ${new Date(device.last).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Not used yet";
    case "camera":
      return device.streamable ? "Live view" : "No video over Matter";
    case "scene":
      return "Runs on tap";
    case "media_player":
      if (device.state === "off") return "Off";
      if (!device.title) return device.state === "idle" ? "Nothing playing" : device.state === "playing" ? "Playing" : "Paused";
      return `${device.state === "playing" ? "Playing" : "Paused"} · ${device.title}`;
  }
}
