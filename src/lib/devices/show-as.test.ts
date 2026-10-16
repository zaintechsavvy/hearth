import { describe, expect, it } from "vitest";
import { showAs, type FanDevice } from "./types";

const fan: FanDevice = { integrationId: "ha", id: "ha:fan.porch", name: "Porch", room: "Outside", available: true, kind: "fan", on: true, adjustable: true, speed: 60 };

describe("showAs", () => {
  it("shows a fan as a light switch that only turns on and off", () => {
    expect(showAs(fan, "switch")).toEqual({ integrationId: "ha", id: "ha:fan.porch", name: "Porch", room: "Outside", available: true, auxiliary: undefined, sourceName: undefined, sourceRoom: undefined, sourceKind: "fan", kind: "switch", on: true });
  });

  it("shows it as a plain light, never dimmable, and remembers the original kind", () => {
    expect(showAs(fan, "light")).toMatchObject({ kind: "light", on: true, dimmable: false, brightness: 100, supportsColor: false, sourceKind: "fan" });
  });
});
