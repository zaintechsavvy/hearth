import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { conditionHolds, fireTime, matches, summarize } from "./logic";
import { sunTimes } from "./sun";

const toronto = { name: "Toronto", latitude: 43.65, longitude: -79.38 };

describe("sun", () => {
  it("knows roughly when the sun sets in Toronto in October", () => {
    const sun = sunTimes(new Date("2026-10-12T12:00:00-04:00"), toronto.latitude, toronto.longitude);
    expect(sun).not.toBeNull();
    expect(sun!.sunset.toISOString().slice(11, 16)).toMatch(/^22:(3|4)\d$/);
    expect(sun!.sunrise.toISOString().slice(11, 16)).toMatch(/^11:(1|2)\d$/);
  });

  it("returns null during polar night", () => {
    expect(sunTimes(new Date("2026-12-21T12:00:00Z"), 78.2, 15.6)).toBeNull();
  });
});

const lamp: Device = { id: "a:lamp", integrationId: "a", name: "Porch light", room: null, available: true, kind: "light", on: false, dimmable: false, brightness: 0, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null };
const garage: Device = { id: "a:garage", integrationId: "a", name: "Garage", room: null, available: true, kind: "cover", coverClass: "garage", state: "open", position: null, canSetPosition: false, canStop: true };

describe("automation logic", () => {
  it("matches device states", () => {
    expect(matches(lamp, { is: "off" })).toBe(true);
    expect(matches(garage, { is: "open" })).toBe(true);
    expect(matches(lamp, { is: "locked" })).toBe(false);
  });

  it("fires time triggers only on chosen days", () => {
    const monday = new Date("2026-10-12T09:00:00");
    expect(fireTime({ type: "time", at: "23:00", days: [1, 2, 3, 4, 5] }, monday, null)?.getHours()).toBe(23);
    expect(fireTime({ type: "time", at: "23:00", days: [0, 6] }, monday, null)).toBeNull();
    expect(fireTime({ type: "sun", event: "sunset", offset: 0, days: [] }, monday, null)).toBeNull();
  });

  it("checks time windows across midnight", () => {
    expect(conditionHolds({ type: "time", after: "22:00", before: "06:00" }, new Map(), new Date("2026-10-12T23:30:00"), null)).toBe(true);
  });

  it("reads a rule as a sentence", () => {
    const devices = new Map<string, Device>([[lamp.id, lamp], [garage.id, garage]]);
    expect(summarize({ type: "sun", event: "sunset", offset: 0, days: [] }, [{ type: "device", deviceId: lamp.id, command: { type: "power", on: true } }], devices, new Map()))
      .toBe("At sunset every day, turn on Porch light.");
    expect(summarize({ type: "device", deviceId: garage.id, match: { is: "open" }, forMinutes: 10 }, [{ type: "notify", title: "Garage open", body: "" }], devices, new Map()))
      .toBe('When Garage opens and stays that way for 10 min, send "Garage open".');
  });
});
