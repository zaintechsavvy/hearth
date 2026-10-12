import type { Device } from "@/lib/devices/types";
import type { TileColor, TileIcon } from "./layout";

/** The icon and colour a tile starts with until someone picks their own. */
export function defaultStyle(device: Device): { icon: TileIcon; color: TileColor } {
  switch (device.kind) {
    case "light":
      return { icon: "lightbulb", color: "amber" };
    case "fan":
      return { icon: "fan", color: "teal" };
    case "switch":
      return { icon: "plug", color: "green" };
    case "lock":
      return { icon: "lock", color: "blue" };
    case "cover":
      return { icon: device.coverClass === "garage" ? "garage" : device.coverClass === "door" || device.coverClass === "gate" ? "door-closed" : "blinds", color: "graphite" };
    case "binary_sensor":
      return {
        icon: device.sensorClass === "motion" || device.sensorClass === "occupancy" ? "activity" : device.sensorClass === "leak" ? "droplets" : device.sensorClass === "smoke" ? "flame" : "door-closed",
        color: "orange",
      };
    case "sensor":
      return {
        icon: device.sensorClass === "temperature" ? "thermometer" : device.sensorClass === "humidity" ? "droplets" : device.sensorClass === "battery" ? "battery" : device.sensorClass === "illuminance" ? "sun" : "gauge",
        color: "teal",
      };
    case "event":
      return { icon: device.eventClass === "doorbell" ? "bell-ring" : "bell", color: "rose" };
    case "scene":
      return { icon: device.variant === "button" ? "power" : device.variant === "script" ? "play" : "clapperboard", color: "violet" };
    case "thermostat":
    case "camera":
      return { icon: "house", color: "graphite" };
  }
}
