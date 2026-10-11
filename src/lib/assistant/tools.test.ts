import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { parseToolInput, toCommand } from "./tools";

const lamp: Device = { id: "a:lamp", integrationId: "a", name: "Lamp", room: "Bedroom", available: true, kind: "light", on: false, dimmable: false, brightness: 0 };
const thermostat: Device = { id: "a:t", integrationId: "a", name: "Hall", room: null, available: true, kind: "thermostat", unit: "C", current: 20, target: 21, min: 10, max: 30, step: 0.5, mode: "heat", modes: ["off", "heat"], action: "idle" };

describe("assistant tools", () => {
  it("parses JSON string arguments and rejects junk", () => {
    expect(parseToolInput("{\"device_id\":\"a:lamp\",\"action\":\"turn_on\"}")).toEqual({ device_id: "a:lamp", action: "turn_on" });
    expect(typeof parseToolInput("not json")).toBe("string");
  });

  it("maps actions onto commands and explains what a device cannot do", () => {
    expect(toCommand(lamp, { device_id: "a:lamp", action: "turn_on" })).toEqual({ type: "power", on: true });
    expect(toCommand(lamp, { device_id: "a:lamp", action: "set_brightness", value: 40 })).toBe("Lamp cannot be dimmed.");
    expect(toCommand(thermostat, { device_id: "a:t", action: "set_temperature", value: 22 })).toEqual({ type: "targetTemperature", value: 22 });
    expect(toCommand(thermostat, { device_id: "a:t", action: "set_mode", mode: "cool" })).toBe("Hall supports these modes: off, heat.");
  });
});
