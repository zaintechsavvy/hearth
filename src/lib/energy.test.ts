import { describe, expect, it } from "vitest";
import type { SensorDevice } from "@/lib/devices/types";
import { lastRun, pickMeters, todayUse } from "./energy";

const sensor = (id: string, name: string, sensorClass: "power" | "energy", value: number, unit = sensorClass === "power" ? "W" : "kWh"): SensorDevice =>
  ({ id, integrationId: "a", name, room: null, available: true, kind: "sensor", sensorClass, value, unit });

describe("energy", () => {
  it("finds the whole-home meters and ranks the rest", () => {
    const meters = pickMeters([sensor("a", "Home power", "power", 600), sensor("b", "Fridge power", "power", 80), sensor("c", "TV power", "power", 120), sensor("d", "Home energy", "energy", 9)]);
    expect(meters.main?.id).toBe("a");
    expect(meters.total?.id).toBe("d");
    expect(meters.parts.map(part => part.id)).toEqual(["c", "b"]);
  });

  it("works out today's use from the running total", () => {
    const now = new Date("2026-10-14T15:00:00");
    const midnight = new Date("2026-10-14T00:00:00").getTime();
    expect(todayUse(sensor("d", "Home energy", "energy", 1210), [{ t: midnight - 3_600_000, v: 1199 }, { t: midnight + 60_000, v: 1200 }], now)).toBe(10);
  });

  it("finds the last cycle and ignores blips", () => {
    const at = (minute: number, v: number) => ({ t: minute * 60_000, v });
    expect(lastRun([at(0, 0), at(10, 500), at(60, 400), at(70, 0), at(80, 30), at(81, 0)], 5)).toEqual({ start: 10 * 60_000, end: 70 * 60_000 });
    expect(lastRun([at(0, 0), at(10, 800)], 5)).toEqual({ start: 10 * 60_000, end: null });
    expect(lastRun([at(0, 0), at(1, 0)], 5)).toBeNull();
  });
});
