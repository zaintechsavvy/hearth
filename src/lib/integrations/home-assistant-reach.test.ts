import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssistantProvider } from "./home-assistant";
import { IntegrationError } from "./types";

/** A HomeKit fan that answers a forced poll when `wakes`, as Home Assistant reports it, recording each service called. */
function fakeHomeAssistant(state: string, wakes: boolean) {
  const calls: string[] = [];
  let current = state;
  vi.stubGlobal("fetch", async (input: URL) => {
    const { pathname } = new URL(input);
    if (pathname === "/api/states/fan.standing") return Response.json({ entity_id: "fan.standing", state: current, attributes: { friendly_name: "Standing fan" } });
    if (pathname.startsWith("/api/services/")) {
      const service = pathname.slice("/api/services/".length);
      calls.push(service);
      if (service === "homeassistant/update_entity" && wakes) current = "off";
      return Response.json([]);
    }
    return new Response(null, { status: 404 });
  });
  return calls;
}

let server = 0;
const provider = () => new HomeAssistantProvider("ha", { url: `http://ha-reach-${++server}.test:8123`, token: "token" });

afterEach(() => { vi.unstubAllGlobals(); });

describe("commands to an unavailable entity", () => {
  it("sends straight away when the entity is reachable", async () => {
    const calls = fakeHomeAssistant("off", false);
    await provider().execute("fan.standing", { type: "power", on: true });
    expect(calls).toEqual(["homeassistant/turn_on"]);
  });

  it("asks Home Assistant to poll it first, then sends once it answers", async () => {
    const calls = fakeHomeAssistant("unavailable", true);
    await provider().execute("fan.standing", { type: "fanSpeed", value: 60 });
    expect(calls).toEqual(["homeassistant/update_entity", "fan/set_percentage"]);
  });

  it("says it is not responding instead of a call Home Assistant would drop", async () => {
    const calls = fakeHomeAssistant("unavailable", false);
    const sent = provider().execute("fan.standing", { type: "power", on: true });
    await expect(sent).rejects.toBeInstanceOf(IntegrationError);
    await expect(sent).rejects.toThrow("Standing fan is not responding to Home Assistant.");
    expect(calls).toEqual(["homeassistant/update_entity"]);
  });
});
