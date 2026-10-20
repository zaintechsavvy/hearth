import { BellRing, Cpu, DoorOpen, Droplets, Flame, History, Lightbulb, Lock, LockOpen, Thermometer, Workflow, type LucideIcon } from "lucide-react";
import { TILE_ICON_COMPONENTS } from "@/components/dashboard/tiles/tile-icons";
import type { ActivityCategory, ActivityEntry } from "@/lib/activity-types";
import { defaultStyle } from "@/lib/dashboard/style";
import type { Device } from "@/lib/devices/types";

const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = { doors: DoorOpen, lights: Lightbulb, sensors: BellRing, climate: Thermometer, household: History, automations: Workflow, system: Cpu };

/** The device's own icon where Hearth knows the device, so a television reads as one; otherwise one for what happened. */
export function activityIcon(entry: ActivityEntry, devices: Map<string, Device>): LucideIcon {
  if (entry.what === "unlocked") return LockOpen;
  if (entry.what === "locked" || entry.what === "jammed") return Lock;
  if (entry.what.includes("leak") || entry.what === "is dry again") return Droplets;
  if (entry.what.includes("smoke")) return Flame;
  if (entry.what === "rang") return BellRing;
  const device = entry.deviceId ? devices.get(entry.deviceId) : undefined;
  return device ? TILE_ICON_COMPONENTS[defaultStyle(device).icon] : CATEGORY_ICONS[entry.category];
}

/** Something switched on, opened, or set going, which shows in the warm colour a lit tile has; off and shut stay grey. */
const LIT = /^(turned on|opened|unlocked|started|noticed|came home)/;
export const activityLit = (entry: ActivityEntry) => LIT.test(entry.group?.[0].what ?? entry.what);
