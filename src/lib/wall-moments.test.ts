import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { DEFAULT_WALL } from "./wall";
import { entryMoments, momentAllowed, momentKind, momentModeOf } from "./wall-moments";

const base = { integrationId: "ha", room: "Entry", available: true };
const devices: Device[] = [
  { ...base, id: "ha:lock.front", name: "Front door", kind: "lock", state: "locked" },
  { ...base, id: "ha:cover.garage", name: "Garage door", kind: "cover", coverClass: "garage", state: "closed", position: null, canStop: true, canSetPosition: false },
  { ...base, id: "ha:cover.blind", name: "Blind", kind: "cover", coverClass: "blind", state: "open", position: 100, canStop: true, canSetPosition: true },
  { ...base, id: "ha:light.porch", name: "Porch", kind: "light", on: true, dimmable: false, brightness: 100, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null },
  { ...base, id: "ha:binary_sensor.window", name: "Kitchen window", kind: "binary_sensor", sensorClass: "window", active: true },
  { ...base, id: "ha:binary_sensor.leak", name: "Sink", kind: "binary_sensor", sensorClass: "leak", active: false },
  { ...base, id: "ha:binary_sensor.hall", name: "Hall motion", kind: "binary_sensor", sensorClass: "motion", active: true },
];

describe("momentKind", () => {
  it("names the scene of each device that can take the screen, and leaves the rest out", () => {
    expect(devices.map(momentKind)).toEqual(["lock", "garage", null, "light", "window", null, null]);
  });
});

describe("momentAllowed", () => {
  it("plays every device by default, awake or resting", () => {
    expect(momentAllowed(DEFAULT_WALL, "ha:light.porch", false)).toBe(true);
    expect(momentAllowed(DEFAULT_WALL, "ha:light.porch", true)).toBe(true);
  });

  it("plays only the chosen devices when limited", () => {
    const settings = { ...DEFAULT_WALL, moments: "chosen" as const, momentDevices: ["ha:cover.garage"] };
    expect(momentAllowed(settings, "ha:cover.garage", false)).toBe(true);
    expect(momentAllowed(settings, "ha:light.porch", false)).toBe(false);
  });

  it("plays nothing when off, and nothing over the resting screen when kept to waking hours", () => {
    expect(momentAllowed({ ...DEFAULT_WALL, moments: "off" }, "ha:cover.garage", false)).toBe(false);
    const awakeOnly = { ...DEFAULT_WALL, momentsResting: false };
    expect(momentAllowed(awakeOnly, "ha:cover.garage", false)).toBe(true);
    expect(momentAllowed(awakeOnly, "ha:cover.garage", true)).toBe(false);
  });

  it("reads a stored mode it does not know as every device", () => {
    expect(momentModeOf("sometimes")).toBe("all");
    expect(momentModeOf(undefined)).toBe("all");
  });
});

describe("entryMoments", () => {
  it("starts a limited list with the ways into the home, not the lights", () => {
    expect(entryMoments(devices)).toEqual(["ha:lock.front", "ha:cover.garage", "ha:binary_sensor.window"]);
  });
});
