import { describe, expect, it } from "vitest";
import { applyCommand, livePosition, parseDeviceId, type ThermostatDevice } from "./types";

const thermostat: ThermostatDevice = { id: "a:t", integrationId: "a", name: "T", room: null, available: true, kind: "thermostat", unit: "C", current: 20, target: 21, min: 10, max: 30, step: 0.5, mode: "off", modes: ["off", "cool"], action: "off" };

describe("devices", () => {
  it("clamps setpoints to the device range", () => {
    expect(applyCommand(thermostat, { type: "targetTemperature", value: 40 }).target).toBe(30);
  });

  it("turns a thermostat on to its first real mode", () => {
    expect(applyCommand(thermostat, { type: "power", on: true }).mode).toBe("cool");
  });

  it("splits ids on the first colon only", () => {
    expect(parseDeviceId("abc:light.kitchen")).toEqual({ integrationId: "abc", nativeId: "light.kitchen" });
    expect(parseDeviceId("nope")).toBeNull();
  });
});

describe("livePosition", () => {
  const base = { id: "a:m", integrationId: "a", name: "Music", room: null, available: true, kind: "media_player" as const, title: "T", artist: null, artwork: null, duration: 100, volume: null, outputs: [], output: null, can: { pause: true, seek: true, next: true, previous: true, volume: false, output: false } };

  it("runs the clock forward while playing and holds it while paused", () => {
    const at = Date.parse("2026-10-14T10:00:00Z");
    expect(livePosition({ ...base, state: "playing", position: 10, positionAt: new Date(at).toISOString() }, at + 5000)).toBe(15);
    expect(livePosition({ ...base, state: "paused", position: 10, positionAt: new Date(at).toISOString() }, at + 5000)).toBe(10);
    expect(livePosition({ ...base, state: "playing", position: 98, positionAt: new Date(at).toISOString() }, at + 9000)).toBe(100);
  });
});
