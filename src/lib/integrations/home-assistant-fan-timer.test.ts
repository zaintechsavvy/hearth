import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssistantProvider, withFanTimer, type HassState } from "./home-assistant";
import type { ThermostatDevice } from "@/lib/devices/types";

/** A thermostat whose fan runs `auto` or `on`, in a Home Assistant that records each call. */
function fakeHomeAssistant(fanModes = ["auto", "on"], fanMode = "auto") {
  const calls: { path: string; method: string; data: unknown }[] = [];
  vi.stubGlobal("fetch", async (input: URL, init?: RequestInit) => {
    const { pathname } = new URL(input);
    if (pathname === "/api/states/climate.hall" && !init?.method) return Response.json({ entity_id: "climate.hall", state: "heat", attributes: { fan_modes: fanModes, fan_mode: fanMode } });
    calls.push({ path: pathname, method: init?.method ?? "GET", data: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json([]);
  });
  return calls;
}

let server = 0;
function provider(platform?: string) {
  const ha = new HomeAssistantProvider("ha", { url: `http://ha-${++server}.test:8123`, token: "token" });
  const live = ha["live"];
  if (platform) live.platforms.set("climate.hall", platform);
  vi.spyOn(live, "waitUntilReady").mockResolvedValue(true);
  const start = vi.spyOn(live, "start").mockResolvedValue();
  return { ha, start };
}
const services = (calls: { path: string; data: unknown }[]) => calls.filter(call => call.path.startsWith("/api/services/")).map(call => [call.path.slice(14), call.data]);

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("a thermostat's fan timer", () => {
  it("uses Nest's own timer", async () => {
    const calls = fakeHomeAssistant(["on", "off"], "off");
    const { ha, start } = provider("nest");
    await ha.execute("climate.hall", { type: "thermostatFanTimer", minutes: 45 });
    expect(services(calls)).toEqual([["nest/set_fan_timer", { entity_id: "climate.hall", duration: { minutes: 45 } }]]);
    expect(start).not.toHaveBeenCalled();
  });

  it("elsewhere turns the fan on and leaves Home Assistant a script to turn it back", async () => {
    const calls = fakeHomeAssistant(["auto", "on", "low"], "low");
    const { ha, start } = provider("ecobee");
    await ha.execute("climate.hall", { type: "thermostatFanTimer", minutes: 120 });
    expect(calls[0]).toMatchObject({ path: "/api/events/hearth_fan_timer", data: { entity_id: "climate.hall" } });
    expect(services(calls)).toEqual([["climate/set_fan_mode", { entity_id: "climate.hall", fan_mode: "on" }]]);
    const [script] = start.mock.calls[0];
    expect(script).toMatchObject({ type: "execute_script", sequence: [{ timeout: { minutes: 120 }, continue_on_timeout: true }, { condition: "template" }, { action: "climate.set_fan_mode", data: { fan_mode: "low" } }] });
    expect(calls.at(-1)).toMatchObject({ path: "/api/states/sensor.hearth_fan_timer_hall", method: "POST", data: { attributes: { device_class: "timestamp" } } });
  });

  it("stops by ending Hearth's timer and going back to auto, and runs untimed with plain on", async () => {
    const calls = fakeHomeAssistant(["auto", "on"], "on");
    const { ha, start } = provider();
    await ha.execute("climate.hall", { type: "thermostatFanTimer", minutes: 0 });
    await ha.execute("climate.hall", { type: "thermostatFanTimer", minutes: null });
    expect(calls.filter(call => call.method === "DELETE")).toHaveLength(2);
    expect(services(calls)).toEqual([["climate/set_fan_mode", { entity_id: "climate.hall", fan_mode: "auto" }], ["climate/set_fan_mode", { entity_id: "climate.hall", fan_mode: "on" }]]);
    expect(start).not.toHaveBeenCalled();
  });

  it("refuses a fan with no on mode", async () => {
    fakeHomeAssistant(["auto", "low", "high"]);
    await expect(provider().ha.execute("climate.hall", { type: "thermostatFanTimer", minutes: 30 })).rejects.toThrow("cannot run on a timer");
  });
});

describe("withFanTimer", () => {
  const thermostat = { kind: "thermostat", fanMode: "on", fanModes: ["auto", "on"] } as ThermostatDevice;
  const now = Date.parse("2026-11-26T12:00:00Z");
  const state = (entity_id: string, value: string): [string, HassState] => [entity_id, { entity_id, state: value, attributes: {} }];

  it("reads when the timer ends from Nest's sensor, or else Hearth's marker", () => {
    expect(withFanTimer(thermostat, "climate.hall", new Map([state("sensor.hall_fan_timer_timeout", "2026-11-26T12:30:00+00:00")]), undefined, now))
      .toMatchObject({ fanTimer: "native", fanUntil: "2026-11-26T12:30:00.000Z" });
    expect(withFanTimer(thermostat, "climate.hall", new Map([state("sensor.hearth_fan_timer_hall", "2026-11-26T13:00:00.000Z")]), "ecobee", now))
      .toMatchObject({ fanTimer: "scripted", fanUntil: "2026-11-26T13:00:00.000Z" });
  });

  it("drops a timer that has ended, or a fan someone turned back", () => {
    const markers = new Map([state("sensor.hearth_fan_timer_hall", "2026-11-26T11:00:00.000Z")]);
    expect(withFanTimer(thermostat, "climate.hall", markers, undefined, now).fanUntil).toBeNull();
    expect(withFanTimer({ ...thermostat, fanMode: "auto" }, "climate.hall", new Map([state("sensor.hearth_fan_timer_hall", "2026-11-26T13:00:00.000Z")]), undefined, now).fanUntil).toBeNull();
    expect(withFanTimer({ ...thermostat, fanModes: ["low", "high"] }, "climate.hall", markers, undefined, now)).not.toHaveProperty("fanTimer");
  });
});
