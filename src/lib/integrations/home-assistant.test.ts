import { describe, expect, it } from "vitest";
import { mapHassState } from "./home-assistant";

describe("mapHassState", () => {
  it("maps a dimmable light to a 0 to 100 brightness", () => {
    const device = mapHassState("ha", { entity_id: "light.kitchen", state: "on", attributes: { friendly_name: "Kitchen", brightness: 128, supported_color_modes: ["brightness"] } }, "C");
    expect(device).toMatchObject({ id: "ha:light.kitchen", kind: "light", name: "Kitchen", on: true, dimmable: true, brightness: 50 });
  });

  it("reports an on/off light as not dimmable", () => {
    const device = mapHassState("ha", { entity_id: "light.porch", state: "off", attributes: { supported_color_modes: ["onoff"] } }, "C");
    expect(device).toMatchObject({ kind: "light", on: false, dimmable: false, brightness: 0 });
  });

  it("maps a range thermostat to its midpoint and heat_cool to auto", () => {
    const device = mapHassState("ha", {
      entity_id: "climate.hall",
      state: "heat_cool",
      attributes: { current_temperature: 70, target_temp_low: 68, target_temp_high: 74, hvac_modes: ["off", "heat", "cool", "heat_cool"], hvac_action: "idle", min_temp: 45, max_temp: 95 },
    }, "F");
    expect(device).toMatchObject({ kind: "thermostat", unit: "F", target: 71, mode: "auto", modes: ["off", "heat", "cool", "auto"], action: "idle", step: 1 });
  });

  it("marks unavailable entities and ignores unsupported domains", () => {
    expect(mapHassState("ha", { entity_id: "switch.plug", state: "unavailable", attributes: {} }, "C")).toMatchObject({ kind: "switch", available: false });
    expect(mapHassState("ha", { entity_id: "sensor.humidity", state: "40", attributes: {} }, "C")).toBeNull();
  });

  it("only offers speed control when the fan supports it", () => {
    expect(mapHassState("ha", { entity_id: "fan.bed", state: "on", attributes: { supported_features: 1, percentage: 33 } }, "C")).toMatchObject({ adjustable: true, speed: 33 });
    expect(mapHassState("ha", { entity_id: "fan.bath", state: "on", attributes: { supported_features: 0 } }, "C")).toMatchObject({ adjustable: false, speed: 100 });
  });
});
