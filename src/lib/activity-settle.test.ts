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
