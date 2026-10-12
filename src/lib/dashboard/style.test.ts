import { describe, expect, it } from "vitest";
import { kindLabel, statusText } from "@/lib/devices/status";
import { shownByDefault, type Device } from "@/lib/devices/types";
import { defaultStyle } from "./style";

const base = { integrationId: "a", room: null, available: true };
const light = (name: string): Device => ({ ...base, id: `a:${name}`, name, kind: "light", on: true, dimmable: true, brightness: 60, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null });
const plug = (name: string): Device => ({ ...base, id: `a:${name}`, name, kind: "switch", on: false });

describe("icons and labels for the device picker", () => {
  it("picks icons from names and kinds", () => {
    expect(defaultStyle(light("Dining chandelier")).icon).toBe("lamp-ceiling");
    expect(defaultStyle(light("Floor lamp")).icon).toBe("lamp-floor");
    expect(defaultStyle(plug("Living room TV")).icon).toBe("tv");
    expect(defaultStyle(plug("Kettle")).icon).toBe("cooking-pot");
    expect(defaultStyle(plug("Office plug")).icon).toBe("plug");
    expect(defaultStyle({ ...base, id: "a:c", name: "Aqara camera", kind: "camera", streamable: true }).icon).toBe("camera");
    expect(defaultStyle({ ...base, id: "a:g", name: "Garage", kind: "cover", coverClass: "garage", state: "closed", position: 0, canStop: true, canSetPosition: false }).icon).toBe("garage");
  });

  it("describes status and type in a few words", () => {
    expect(`${kindLabel(light("Lamp"))} · ${statusText(light("Lamp"))}`).toBe("Light · On · 60%");
    expect(statusText({ ...base, id: "a:l", name: "Lock", kind: "lock", state: "jammed" })).toBe("Jammed");
  });

  it("leaves settings, diagnostic, and unavailable entries off by default", () => {
    expect(shownByDefault({ ...plug("Child lock"), auxiliary: true })).toBe(false);
    expect(shownByDefault({ ...plug("Fan plug"), available: false })).toBe(false);
    expect(shownByDefault(plug("Fan plug"))).toBe(true);
  });
});
