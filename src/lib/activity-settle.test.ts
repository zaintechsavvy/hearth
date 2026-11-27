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
    const entries = [entry("lamp", "turned on", 3), entry("door", "opened", 2), entry("bedroom", "noticed someone", 1)];
    expect(settle(entries, new Set(["bedroom"])).map(item => item.id)).toEqual(["lamp:3", "door:2"]);
  });
});

describe("settle, outages", () => {
  const now = Date.UTC(2026, 9, 19, 13, 0);

  it("drops a device dozing offline for a few minutes, coming back or not yet back", () => {
    const entries = [entry("fan", "went offline", 58), entry("fan", "came back online", 31), entry("fan", "went offline", 30), entry("lamp", "turned on", 20)];
    expect(settle(entries, new Set(), now).map(item => item.id)).toEqual(["lamp:20"]);
  });

  it("keeps an outage of ten minutes or more, and a change made while away", () => {
    const entries = [entry("fan", "turned on", 45), entry("fan", "went offline", 44), entry("fan", "came back online", 20), entry("fan", "went offline", 5)];
    expect(settle(entries, new Set(), now).map(item => item.id)).toEqual(["fan:45", "fan:20", "fan:5"]);
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

describe("settle, back and forth", () => {
  const at = (deviceId: string, what: string, minute: number): ActivityEntry => ({
    id: `${deviceId}:${what}:${minute}`, at: new Date(Date.UTC(2026, 9, 19, 20, minute)).toISOString(), deviceId, name: deviceId, room: null, what, category: "lights", tone: "info", by: "Dana",
  });

  it("folds the same devices switched back and forth into one line that keeps each time", () => {
    const entries = [
      at("Glide", "turned on", 0), at("Bars", "turned on", 0),
      at("Bars", "turned off", 3), at("Glide", "turned off", 3),
      at("Glide", "turned on", 6), at("Bars", "turned on", 6),
      at("Bars", "turned off", 9), at("Glide", "turned off", 9),
      at("Porch", "turned on", 7),
    ].reverse();
    const lines = settle(entries, new Set());
    expect(lines.map(line => `${line.name} ${line.what}`)).toEqual(["Bars and Glide turned on and off 4 times", "Porch turned on"]);
    expect(lines[0].group?.map(line => line.what)).toEqual(["turned off", "turned on", "turned off", "turned on"]);
  });

  it("tells one on and off as one line, and leaves changes far apart as they are", () => {
    const lines = settle([at("Lamp", "turned off", 40), at("Lamp", "turned on", 20), at("Lamp", "turned off", 5), at("Lamp", "turned on", 0)], new Set());
    expect(lines.map(line => line.what)).toEqual(["turned off", "turned on", "turned on and off"]);
    expect(lines[2].group?.map(line => line.what)).toEqual(["turned off", "turned on"]);
  });
});

describe("settle, steps", () => {
  const set = (value: number, second: number, by: string | null = "Alex"): ActivityEntry => ({
    id: `home:${second}`, at: new Date(Date.UTC(2026, 9, 19, 12, 0, second)).toISOString(), deviceId: "home", name: "Home", room: null, what: `was set to ${value}°C`, category: "climate", tone: "info", by,
  });

  it("tells a thermostat nudged up step by step as one change from where it started", () => {
    const [line] = settle([set(26.5, 20), set(26, 10), set(25.5, 0)], new Set());
    expect(line.what).toBe("was set from 25° to 26.5°C");
    expect(line.group?.map(item => item.id)).toEqual(["home:20", "home:10", "home:0"]);
  });

  it("keeps changes a while apart, and by different people, as their own lines", () => {
    const apart = settle([{ ...set(26, 0), at: new Date(Date.UTC(2026, 9, 19, 12, 5)).toISOString(), id: "late" }, set(25.5, 0)], new Set());
    expect(apart.map(line => line.what)).toEqual(["was set to 26°C", "was set to 25.5°C"]);
    expect(settle([set(26, 10, "Sam"), set(25.5, 0)], new Set())).toHaveLength(2);
  });

  it("says only where it ended when the steps were uneven", () => {
    expect(settle([set(24, 20), set(26, 10), set(25.5, 0)], new Set())[0].what).toBe("was set to 24°C");
  });
});
