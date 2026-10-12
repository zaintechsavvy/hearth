import type { TileColor, TileIcon, TileKind } from "./layout";

export interface KindInfo {
  label: string;
  description: string;
  icon: TileIcon;
  color: TileColor;
}

/** What each tile type is called and looks like before it is linked to anything. */
export const KIND_INFO: Record<TileKind, KindInfo> = {
  light: { label: "Light", description: "Switch and dim a light", icon: "lightbulb", color: "amber" },
  switch: { label: "Switch", description: "A plug or anything with on and off", icon: "plug", color: "green" },
  fan: { label: "Fan", description: "On, off, and speed", icon: "fan", color: "teal" },
  thermostat: { label: "Thermostat", description: "Temperature and mode", icon: "thermometer", color: "orange" },
  lock: { label: "Lock", description: "A front door or gate lock", icon: "lock", color: "blue" },
  cover: { label: "Garage door or blind", description: "Garage doors, gates, blinds, and shades", icon: "garage", color: "graphite" },
  binary_sensor: { label: "Door or motion sensor", description: "Open and closed, motion, leaks, smoke", icon: "door-closed", color: "orange" },
  sensor: { label: "Reading", description: "Temperature, humidity, battery, and more", icon: "gauge", color: "teal" },
  camera: { label: "Camera", description: "A live view", icon: "camera", color: "graphite" },
  event: { label: "Doorbell", description: "When it last rang, with an alert", icon: "bell-ring", color: "rose" },
  scene: { label: "Scene", description: "Set several things at once", icon: "clapperboard", color: "violet" },
  weather: { label: "Weather", description: "Now and the days ahead for any city", icon: "sun", color: "blue" },
  calendar: { label: "Calendar", description: "What is coming up, from Google Calendar or any iCal feed", icon: "calendar", color: "rose" },
  reminders: { label: "Reminders", description: "A short list to check off", icon: "list-checks", color: "amber" },
  clock: { label: "Clock", description: "Time and date", icon: "clock", color: "graphite" },
};

export const ADDABLE_KINDS: TileKind[] = ["light", "switch", "fan", "thermostat", "lock", "cover", "camera", "event", "binary_sensor", "sensor", "scene", "weather", "calendar", "reminders", "clock"];
