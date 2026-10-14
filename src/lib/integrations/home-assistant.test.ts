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

  it("maps colour and white temperature for lights that support them", () => {
    const color = mapHassState("ha", { entity_id: "light.strip", state: "on", attributes: { supported_color_modes: ["hs", "color_temp"], color_mode: "hs", hs_color: [210.4, 80.2], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, brightness: 255 } }, "C");
    expect(color).toMatchObject({ supportsColor: true, color: { hue: 210, saturation: 80 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 } });
    const white = mapHassState("ha", { entity_id: "light.bulb", state: "on", attributes: { supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 2700, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 5000 } }, "C");
    expect(white).toMatchObject({ supportsColor: false, color: null, colorMode: "white", temperature: 2700 });
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

  it("maps locks, covers, sensors, cameras, doorbells, and scenes", () => {
    const map = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => mapHassState("ha", { entity_id, state, attributes }, "C", "Entry");
    expect(map("lock.front", "locked")).toMatchObject({ kind: "lock", state: "locked", room: "Entry" });
    expect(map("cover.garage", "opening", { device_class: "garage", supported_features: 11 })).toMatchObject({ kind: "cover", coverClass: "garage", state: "opening", canStop: true, canSetPosition: false });
    expect(map("cover.blinds", "open", { device_class: "blind", current_position: 40, supported_features: 15 })).toMatchObject({ coverClass: "blind", position: 40, canSetPosition: true });
    expect(map("binary_sensor.back_door", "on", { device_class: "door" })).toMatchObject({ kind: "binary_sensor", sensorClass: "door", active: true });
    expect(map("sensor.hall_temperature", "21.5", { device_class: "temperature", unit_of_measurement: "°C" })).toMatchObject({ kind: "sensor", sensorClass: "temperature", value: 21.5, unit: "°C" });
    expect(map("sensor.uptime", "12")).toBeNull();
    expect(map("camera.porch", "streaming")).toMatchObject({ kind: "camera", streamable: true });
    expect(map("event.doorbell", "2026-10-11T20:00:00.000+00:00", { device_class: "doorbell" })).toMatchObject({ kind: "event", eventClass: "doorbell", last: "2026-10-11T20:00:00.000+00:00" });
    expect(map("event.doorbell", "unknown", { device_class: "doorbell" })).toMatchObject({ last: null });
    expect(map("scene.movie_night", "2026-10-11T19:00:00+00:00")).toMatchObject({ kind: "scene", variant: "scene", available: true });
    expect(map("button.restart", "unknown")).toMatchObject({ kind: "scene", variant: "button" });
    expect(map("update.core", "off")).toBeNull();
  });
});

describe("media players", () => {
  const spotify = {
    entity_id: "media_player.spotify",
    state: "playing",
    attributes: {
      friendly_name: "Spotify", supported_features: 1 | 2 | 4 | 16 | 32 | 2048, media_title: "Night Bus", media_artist: "The Quiet Hours",
      entity_picture: "/api/media_player_proxy/media_player.spotify?token=secret&cache=ab12", media_position: 30, media_position_updated_at: "2026-10-14T10:00:00Z",
      media_duration: 198, volume_level: 0.42, source_list: ["Kitchen", "AirPods Pro"], source: "Kitchen",
    },
  };

  it("maps what is playing, where, and what the player can do", () => {
    expect(mapHassState("ha", spotify, "C")).toMatchObject({
      kind: "media_player", state: "playing", title: "Night Bus", artist: "The Quiet Hours", duration: 198, volume: 42,
      outputs: ["Kitchen", "AirPods Pro"], output: "Kitchen", can: { pause: true, seek: true, next: true, previous: true, volume: true, output: true },
    });
  });

  it("serves the cover through Hearth without passing on the picture token", () => {
    const device = mapHassState("ha", spotify, "C");
    expect(device?.kind === "media_player" && device.artwork).toBe("/api/devices/ha%3Amedia_player.spotify/artwork?v=ab12");
  });

  it("offers no outputs or volume the player cannot use", () => {
    const device = mapHassState("ha", { entity_id: "media_player.tv", state: "off", attributes: { supported_features: 0 } }, "C");
    expect(device).toMatchObject({ state: "off", title: null, artwork: null, volume: null, can: { volume: false, output: false, next: false } });
  });
});
