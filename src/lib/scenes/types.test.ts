import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { applyScene, captureState, sceneable } from "./types";

const base = { integrationId: "a", room: null, available: true };
const lamp: Device = { ...base, id: "a:lamp", name: "Lamp", kind: "light", on: true, dimmable: true, brightness: 30, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null };
const lock: Device = { ...base, id: "a:lock", name: "Front door", kind: "lock", state: "unlocked" };
const garage: Device = { ...base, id: "a:garage", name: "Garage", kind: "cover", coverClass: "garage", state: "open", position: 100, canStop: true, canSetPosition: true };
const blind: Device = { ...base, id: "a:blind", name: "Blind", kind: "cover", coverClass: "blind", state: "open", position: 40, canStop: true, canSetPosition: true };
const sensor: Device = { ...base, id: "a:t", name: "Hall", kind: "sensor", sensorClass: "temperature", value: 21, unit: "°C" };

describe("scenes", () => {
  it("captures the current state, but only ever locks and closes entry points", () => {
    expect(captureState(lamp)).toEqual([{ type: "brightness", value: 30 }]);
    expect(captureState(lock)).toEqual([{ type: "lock", locked: true }]);
    expect(captureState(garage)).toEqual([{ type: "cover", action: "close" }]);
    expect(captureState(blind)).toEqual([{ type: "coverPosition", value: 40 }]);
    expect(sceneable(sensor)).toBe(false);
  });

  it("applies a scene for optimistic updates and skips devices that are gone", () => {
    const after = applyScene([lamp, lock], [
      { deviceId: "a:lamp", command: { type: "power", on: false } },
      { deviceId: "a:lock", command: { type: "lock", locked: true } },
      { deviceId: "a:missing", command: { type: "power", on: true } },
    ]);
    expect(after).toEqual([{ ...lamp, on: false }, { ...lock, state: "locked" }]);
  });
});
