import { describe, expect, it } from "vitest";
import { isHomeNetworkHost, unreachableMessage } from "./reach";

describe("isHomeNetworkHost", () => {
  it("spots addresses that only exist at home", () => {
    for (const host of ["homeassistant.local", "localhost", "homeassistant", "192.168.1.20", "10.0.0.205", "172.20.1.1", "100.101.1.2", "[fd12:3456::1]"]) expect(isHomeNetworkHost(host)).toBe(true);
  });

  it("leaves public addresses alone", () => {
    for (const host of ["abc123.ui.nabu.casa", "ha.example.com", "8.8.8.8", "172.32.0.1"]) expect(isHomeNetworkHost(host)).toBe(false);
  });
});

describe("unreachableMessage", () => {
  it("explains a cloud server cannot see a home address", () => {
    expect(unreachableMessage("Home Assistant", new URL("http://homeassistant.local:8123"), true)).toContain("runs in the cloud");
  });

  it("keeps the plain message at home", () => {
    expect(unreachableMessage("Home Assistant", new URL("http://homeassistant.local:8123"), false)).toBe("Could not reach Home Assistant at http://homeassistant.local:8123. Check that it is running and that this server can reach that address.");
  });
});
