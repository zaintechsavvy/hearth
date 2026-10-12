import type { Device } from "@/lib/devices/types";
import type { TileColor, TileIcon } from "./layout";

/** The icon and colour a tile starts with until someone picks their own. */
/** Name hints for lights and switches, checked in order; the first match wins. */
const NAME_ICONS: [RegExp, TileIcon][] = [
  [/chandelier|pendant|ceiling/i, "lamp-ceiling"],
  [/desk lamp/i, "lamp-desk"],
  [/floor lamp|standing lamp/i, "lamp-floor"],
  [/lamp/i, "lamp"],
  [/\b(tv|television)\b/i, "tv"],
  [/monitor|computer|\bpc\b/i, "monitor"],
  [/speaker|sonos|stereo/i, "speaker"],
  [/coffee|espresso/i, "coffee"],
  [/kettle|cooker|stove|oven/i, "cooking-pot"],
  [/fridge|refrigerator|freezer/i, "refrigerator"],
  [/microwave/i, "microwave"],
  [/washer|dryer|laundry/i, "washing-machine"],
  [/heater|radiator/i, "heater"],
  [/air ?con|\bac\b|purifier|dehumidifier|humidifier/i, "air-vent"],
  [/router|modem|wi-?fi/i, "router"],
  [/game|console|playstation|xbox/i, "gamepad"],
  [/christmas|tree|garden|plant/i, "leaf"],
  [/night|bedside/i, "moon"],
];

const byName = (name: string) => NAME_ICONS.find(([pattern]) => pattern.test(name))?.[1];

export function defaultStyle(device: Device): { icon: TileIcon; color: TileColor } {
  switch (device.kind) {
    case "light":
      return { icon: byName(device.name) ?? "lightbulb", color: "amber" };
    case "fan":
      return { icon: "fan", color: "teal" };
    case "switch":
      return { icon: byName(device.name) ?? "plug", color: "green" };
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
      return { icon: "thermometer", color: "orange" };
    case "camera":
      return { icon: device.name.match(/doorbell/i) ? "bell-ring" : "camera", color: "graphite" };
  }
}
