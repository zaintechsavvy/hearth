import type { ActivityCategory } from "@/lib/activity-types";
import type { Device } from "@/lib/devices/types";

export interface Change {
  what: string;
  category: ActivityCategory;
  tone: "info" | "warning" | "alert";
}

const ENTRY_CLASSES = new Set(["door", "window", "garage", "opening"]);

const DOMAIN_CATEGORIES: Record<string, ActivityCategory> = { light: "lights", switch: "lights", fan: "lights", input_boolean: "lights", lock: "doors", cover: "doors", climate: "climate", binary_sensor: "sensors", automation: "automations", script: "automations", scene: "automations" };

/** Where an integration's own log entry belongs, from the device when Hearth shows it, otherwise the kind of thing it is. */
export function logbookChange(device: Device | undefined, nativeId: string | null, what: string): Change {
  const category: ActivityCategory = !device ? DOMAIN_CATEGORIES[nativeId?.split(".")[0] ?? ""] ?? "system"
    : device.kind === "light" || device.kind === "switch" || device.kind === "fan" ? "lights"
      : device.kind === "lock" || device.kind === "cover" || (device.kind === "binary_sensor" && ENTRY_CLASSES.has(device.sensorClass)) ? "doors"
        : device.kind === "thermostat" ? "climate"
          : device.kind === "binary_sensor" || device.kind === "sensor" || device.kind === "event" ? "sensors"
            : device.kind === "scene" ? "automations" : "system";
  const tone = what === "jammed" || what.startsWith("detected a leak") || what.startsWith("detected smoke") ? "alert"
    : what === "unlocked" || what === "went offline" || (category === "doors" && what === "opened") ? "warning" : "info";
  return { what, category, tone };
}

/**
 * What changed between two looks at one device, in words for the activity log, or null when nothing worth
 * noting did. Readings are charted rather than logged, and motion clearing is left out as noise.
 */
export function describeChange(before: Device, after: Device): Change | null {
  if (before.kind !== after.kind) return null;
  if (before.available !== after.available) return after.available ? { what: "came back online", category: "system", tone: "info" } : { what: "went offline", category: "system", tone: "warning" };
  if (!after.available) return null;
  switch (after.kind) {
    case "light":
    case "switch":
    case "fan":
      return before.kind === after.kind && "on" in before && before.on !== after.on ? { what: after.on ? "turned on" : "turned off", category: "lights", tone: "info" } : null;
    case "lock": {
      if (before.kind !== "lock" || before.state === after.state) return null;
      if (after.state === "locked") return { what: "locked", category: "doors", tone: "info" };
      if (after.state === "unlocked") return { what: "unlocked", category: "doors", tone: "warning" };
      if (after.state === "jammed") return { what: "jammed", category: "doors", tone: "alert" };
      if (after.state === "open") return { what: "opened", category: "doors", tone: "warning" };
      return null;
    }
    case "cover": {
      if (before.kind !== "cover" || before.state === after.state) return null;
      const entry = after.coverClass === "garage" || after.coverClass === "door" || after.coverClass === "gate";
      if (after.state === "open") return { what: "opened", category: "doors", tone: entry ? "warning" : "info" };
      if (after.state === "closed") return { what: "closed", category: "doors", tone: "info" };
      return null;
    }
    case "binary_sensor": {
      if (before.kind !== "binary_sensor" || before.active === after.active) return null;
      if (ENTRY_CLASSES.has(after.sensorClass)) return { what: after.active ? "opened" : "closed", category: "doors", tone: "info" };
      if (after.sensorClass === "leak") return after.active ? { what: "detected a leak", category: "sensors", tone: "alert" } : { what: "is dry again", category: "sensors", tone: "info" };
      if (after.sensorClass === "smoke") return after.active ? { what: "detected smoke", category: "sensors", tone: "alert" } : { what: "cleared", category: "sensors", tone: "info" };
      if (after.sensorClass === "motion") return after.active ? { what: "noticed motion", category: "sensors", tone: "info" } : null;
      if (after.sensorClass === "occupancy") return after.active ? { what: "noticed someone", category: "sensors", tone: "info" } : null;
      return null;
    }
    case "event":
      return before.kind === "event" && after.last && after.last !== before.last ? { what: after.eventClass === "doorbell" ? "rang" : "was pressed", category: "doors", tone: after.eventClass === "doorbell" ? "warning" : "info" } : null;
    case "thermostat": {
      if (before.kind !== "thermostat") return null;
      if (before.mode !== after.mode) return { what: after.mode === "off" ? "was turned off" : `was set to ${after.mode}`, category: "climate", tone: "info" };
      if (before.target !== after.target && after.target !== null) return { what: `was set to ${after.target}°${after.unit}`, category: "climate", tone: "info" };
      return null;
    }
    default:
      return null;
  }
}
