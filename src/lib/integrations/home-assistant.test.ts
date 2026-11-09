import { describe, expect, it } from "vitest";
import { logbookEntries, mapHassState, recentTracks } from "./home-assistant";

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
      shuffle: true, repeat: "one", group_members: ["media_player.spotify", "media_player.kitchen"], media_content_id: "spotify:track:1", media_content_type: "music",
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

  it("maps shuffle, repeat, the speaker group, and what can play again", () => {
    expect(mapHassState("ha", spotify, "C")).toMatchObject({ shuffle: true, repeat: "one", group: ["ha:media_player.spotify", "ha:media_player.kitchen"], media: { id: "spotify:track:1", type: "music" } });
  });

  it("lists recently played tracks newest first, without the current one", () => {
    const state = (title: string) => ({ entity_id: "media_player.spotify", state: "playing", attributes: { media_title: title, media_artist: "A", media_content_id: `id:${title}`, media_content_type: "music" } });
    expect(recentTracks([state("One"), state("Two"), state("Two"), state("Three")], "Three").map(track => track.title)).toEqual(["Two", "One"]);
  });

  it("offers no outputs or volume the player cannot use", () => {
    const device = mapHassState("ha", { entity_id: "media_player.tv", state: "off", attributes: { supported_features: 0 } }, "C");
    expect(device).toMatchObject({ state: "off", title: null, artwork: null, volume: null, can: { volume: false, output: false, next: false } });
  });
});

describe("new device kinds", () => {
  it("maps people, vacuums, alarms, and lists", () => {
    expect(mapHassState("ha", { entity_id: "person.sam", state: "Work", attributes: { friendly_name: "Sam" }, last_changed: "2026-10-14T08:00:00Z" }, "C"))
      .toMatchObject({ kind: "person", home: false, place: "Work", since: "2026-10-14T08:00:00Z" });
    expect(mapHassState("ha", { entity_id: "person.alex", state: "not_home", attributes: {} }, "C")).toMatchObject({ home: false, place: null });
    expect(mapHassState("ha", { entity_id: "vacuum.roomba", state: "cleaning", attributes: { battery_level: 80, supported_features: 8192 | 4 | 16 } }, "C"))
      .toMatchObject({ kind: "vacuum", state: "cleaning", battery: 80, can: { start: true, pause: true, dock: true, locate: false } });
    expect(mapHassState("ha", { entity_id: "alarm_control_panel.home", state: "armed_away", attributes: { supported_features: 3, code_format: "number", code_arm_required: false } }, "C"))
      .toMatchObject({ kind: "alarm", state: "armed_away", modes: ["home", "away"], codeFormat: "number", codeToArm: false });
    expect(mapHassState("ha", { entity_id: "todo.shopping_list", state: "3", attributes: { supported_features: 7 } }, "C"))
      .toMatchObject({ kind: "todo", open: 3, can: { add: true, remove: true, check: true } });
  });
});

describe("logbookEntries", () => {
  const people = new Map([["user-1", "Sam"]]);
  it("words changes like Hearth and credits who made them", () => {
    const entries = logbookEntries([
      { when: "2026-10-14T08:00:00+00:00", name: "Front door", entity_id: "lock.front", domain: "lock", state: "unlocked", message: "changed to unlocked", context_user_id: "user-1" },
      { when: 1791964800.5, name: "Porch", entity_id: "light.porch", domain: "light", message: "turned on", context_domain: "automation", context_name: "Sunset" },
      { when: "2026-10-14T09:00:00+00:00", name: "Bedtime", entity_id: "automation.bedtime", domain: "automation", message: "triggered by time" },
      { when: "2026-10-14T09:30:00+00:00", name: "Back door", entity_id: "binary_sensor.back_door", domain: "binary_sensor", message: "was opened" },
      { when: "not a time", name: "Broken", message: "turned on" },
    ], people);
    expect(entries.map(entry => [entry.nativeId, entry.what, entry.by])).toEqual([
      ["lock.front", "unlocked", "Sam"],
      ["light.porch", "turned on", "the Sunset automation"],
      ["automation.bedtime", "ran", null],
      ["binary_sensor.back_door", "opened", null],
    ]);
    expect(entries[1].at.getTime()).toBe(1791964800500);
  });

  it("words the live logbook's bare states and says where each change was made", () => {
    const entries = logbookEntries([
      { when: 1791964800, entity_id: "light.kitchen", state: "off", context_user_id: "user-1", context_event_type: "call_service" },
      { when: 1791964801, entity_id: "lock.front", state: "unlocking", context_user_id: "user-1" },
      { when: 1791964802, entity_id: "switch.lamp", state: "on" },
      { when: 1791964803, entity_id: "light.porch", state: "on", context_domain: "automation", context_name: "Sunset" },
    ], people);
    expect(entries.map(entry => [entry.nativeId, entry.what, entry.by, entry.via])).toEqual([
      ["light.kitchen", "turned off", "Sam", "in Home Assistant"],
      ["switch.lamp", "turned on", null, "at the device"],
      ["light.porch", "turned on", "the Sunset automation", null],
    ]);
  });
});
