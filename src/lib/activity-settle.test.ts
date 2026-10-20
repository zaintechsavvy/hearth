import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "./activity-types";
import { settle } from "./activity-settle";

const entry = (deviceId: string, what: string, minute: number): ActivityEntry => ({
  id: `${deviceId}:${minute}`, at: new Date(Date.UTC(2026, 9, 19, 12, minute)).toISOString(), deviceId, name: deviceId, room: null, what, category: "sensors", tone: "info", by: null,
});

describe("settle", () => {
  it("keeps one presence line a quarter of an hour per sensor, newest first", () => {
    const entries = [0, 1, 2, 10, 16, 17].map(minute => entry("occupancy", "noticed someone", minute)).reverse();
    expect(settle(entries, new Set()).map(item => item.id)).toEqual(["occupancy:16", "occupancy:0"]);
  });

  it("leaves other changes alone and drops muted devices", () => {
    const entries = [entry("lamp", "turned on", 3), entry("lamp", "turned off", 2), entry("bedroom", "noticed someone", 1)];
    expect(settle(entries, new Set(["bedroom"])).map(item => item.id)).toEqual(["lamp:3", "lamp:2"]);
  });
});

describe("settle, together", () => {
  const at = (deviceId: string, what: string, second: number, by: string | null = "Dana"): ActivityEntry => ({
    id: `${deviceId}:${second}`, at: new Date(Date.UTC(2026, 9, 19, 12, 0, second)).toISOString(), deviceId, name: deviceId, room: "Kitchen", what, category: "lights", tone: "info", by,
  });

  it("puts devices that changed together into one line", () => {
    const [line] = settle([at("Light 2", "turned on", 1), at("Light 1", "turned on", 0)], new Set());
    expect(line.name).toBe("Light 1 and Light 2");
    expect(line.deviceIds).toEqual(["Light 1", "Light 2"]);
    expect(line.room).toBe("Kitchen");
  });

  it("lists three with commas", () => {
    expect(settle([at("C", "turned off", 2), at("B", "turned off", 1), at("A", "turned off", 0)], new Set())[0].name).toBe("A, B, and C");
  });

  it("keeps apart changes that differ, are far apart, or are worded for one", () => {
    const entries = [at("Lamp", "turned on", 0), at("Fan", "turned off", 1), at("Desk", "turned on", 30), at("Alarm", "was armed", 31), at("Siren", "was armed", 32), at("Porch", "turned on", 33, null)];
    expect(settle(entries, new Set()).map(line => line.name)).toEqual(["Porch", "Siren", "Alarm", "Desk", "Fan", "Lamp"]);
  });
});
