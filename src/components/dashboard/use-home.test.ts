import { describe, expect, it } from "vitest";
import type { DeviceCommand, LightDevice } from "@/lib/devices/types";
import { outranks } from "./use-home";

const light = (brightness: number): LightDevice => ({
  integrationId: "ha", id: "ha:light.chandelier", name: "Chandelier", room: "Dining", available: true, kind: "light",
  on: true, dimmable: true, brightness, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null,
});

describe("a command sent from this screen", () => {
  const command: DeviceCommand = { type: "brightness", value: 50 };

  it("rides out a stale report that comes after the light already agreed", () => {
    const sent = { command, at: 0 };
    expect(outranks(light(100), sent, 300)).toBe(true);
    expect(outranks(light(50), sent, 600)).toBe(false);
    expect(outranks(light(100), sent, 1200)).toBe(true);
    expect(outranks(light(50), sent, 2000)).toBe(false);
  });

  it("takes a brightness a point off as agreeing", () => {
    expect(outranks(light(49), { command, at: 0 }, 300)).toBe(false);
  });

  it("lets a later change from elsewhere through once it has settled", () => {
    const sent = { command, at: 0 };
    outranks(light(50), sent, 500);
    expect(outranks(light(80), sent, 3500)).toBe(false);
  });

  it("gives up on a light that never answers", () => {
    expect(outranks(light(100), { command, at: 0 }, 9000)).toBe(false);
  });
});
