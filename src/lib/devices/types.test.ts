import { describe, expect, it } from "vitest";
import { applyCommand, parseDeviceId, type ThermostatDevice } from "./types";

const thermostat: ThermostatDevice = { id: "a:t", integrationId: "a", name: "T", available: true, kind: "thermostat", unit: "C", current: 20, target: 21, min: 10, max: 30, step: 0.5, mode: "off", modes: ["off", "cool"], action: "off" };

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
