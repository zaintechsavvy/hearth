import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { describeChange, logbookChange } from "./activity-diff";

const base = { integrationId: "a", room: "Entry", available: true };
const lock = (state: "locked" | "unlocked" | "jammed"): Device => ({ ...base, id: "a:lock", name: "Front door", kind: "lock", state });
const door = (active: boolean): Device => ({ ...base, id: "a:door", name: "Back door", kind: "binary_sensor", sensorClass: "door", active });
const leak = (active: boolean): Device => ({ ...base, id: "a:leak", name: "Under sink", kind: "binary_sensor", sensorClass: "leak", active });
const motion = (active: boolean): Device => ({ ...base, id: "a:motion", name: "Hall", kind: "binary_sensor", sensorClass: "motion", active });

describe("describeChange", () => {
  it("logs locks with a warning for unlocking and an alert for jams", () => {
    expect(describeChange(lock("locked"), lock("unlocked"))).toEqual({ what: "unlocked", category: "doors", tone: "warning" });
    expect(describeChange(lock("unlocked"), lock("jammed"))?.tone).toBe("alert");
    expect(describeChange(lock("locked"), lock("locked"))).toBeNull();
  });

  it("reads door sensors as opened and closed, and leaks as alerts", () => {
    expect(describeChange(door(false), door(true))?.what).toBe("opened");
    expect(describeChange(leak(false), leak(true))).toEqual({ what: "detected a leak", category: "sensors", tone: "alert" });
  });

  it("ignores motion clearing", () => {
    expect(describeChange(motion(false), motion(true))?.what).toBe("noticed motion");
    expect(describeChange(motion(true), motion(false))).toBeNull();
  });

  it("notes devices going offline", () => {
    expect(describeChange(door(false), { ...door(false), available: false })).toEqual({ what: "went offline", category: "system", tone: "warning" });
  });
});

describe("logbookChange", () => {
  it("files an integration's entry by the device Hearth shows", () => {
    expect(logbookChange(door(true), "binary_sensor.back_door", "opened")).toEqual({ what: "opened", category: "doors", tone: "warning" });
    expect(logbookChange(motion(true), "binary_sensor.hall", "detected motion").category).toBe("sensors");
  });

  it("falls back to the kind of thing it is for entities Hearth does not show", () => {
    expect(logbookChange(undefined, "automation.bedtime", "ran").category).toBe("automations");
    expect(logbookChange(undefined, "light.porch", "turned on").category).toBe("lights");
    expect(logbookChange(undefined, null, "started")).toEqual({ what: "started", category: "system", tone: "info" });
  });
});
