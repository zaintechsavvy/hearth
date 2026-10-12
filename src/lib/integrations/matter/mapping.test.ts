import { describe, expect, it } from "vitest";
import type { MatterNode } from "./client";
import { mapMatterNode } from "./mapping";

const node = (attributes: Record<string, unknown>, nodeId: number | bigint = 4): MatterNode => ({ node_id: nodeId, available: true, attributes });

describe("mapMatterNode", () => {
  it("maps a dimmable light with tag keyed device types", () => {
    const [light] = mapMatterNode("m", node({ "0/40/3": "Smart Bulb", "1/29/0": [{ "0": 257, "1": 1 }], "1/6/0": true, "1/8/0": 127 })).devices;
    expect(light).toMatchObject({ id: "m:4/1", kind: "light", name: "Smart Bulb", on: true, dimmable: true, brightness: 50 });
  });

  it("prefers the node label and treats a plug as a switch", () => {
    const [plug] = mapMatterNode("m", node({ "0/40/3": "Plug", "0/40/5": "Coffee", "1/29/0": [{ "0": 266, "1": 1 }], "1/6/0": false })).devices;
    expect(plug).toMatchObject({ kind: "switch", name: "Coffee", on: false });
  });

  it("names bridged endpoints individually", () => {
    const devices = mapMatterNode("m", node({
      "0/40/3": "Hub",
      "1/29/0": [{ "0": 14, "1": 1 }],
      "2/29/0": [{ "0": 256, "1": 1 }], "2/57/5": "Hall", "2/6/0": true,
      "3/29/0": [{ "0": 256, "1": 1 }], "3/57/5": "Stairs", "3/6/0": false,
    })).devices;
    expect(devices.map(device => device.name)).toEqual(["Hall", "Stairs"]);
  });

  it("converts thermostat centidegrees and running state", () => {
    const [thermostat] = mapMatterNode("m", node({
      "1/29/0": [{ "0": 769, "1": 4 }],
      "1/513/0": 2050, "1/513/17": 2600, "1/513/18": 2150, "1/513/27": 4, "1/513/28": 4, "1/513/41": 1, "1/513/65532": 0x23,
    })).devices;
    expect(thermostat).toMatchObject({ kind: "thermostat", unit: "C", current: 20.5, target: 21.5, mode: "heat", modes: ["off", "heat", "cool", "auto"], action: "heating" });
  });

  it("uses the midpoint in auto and keeps 64 bit node ids exact", () => {
    const [thermostat] = mapMatterNode("m", node({ "1/513/0": 2200, "1/513/17": 2400, "1/513/18": 2000, "1/513/28": 1 }, 18446744073709551615n)).devices;
    expect(thermostat).toMatchObject({ id: "m:18446744073709551615/1", target: 22, mode: "auto" });
  });

  it("maps an Aqara style lock, contact sensor with battery, and garage cover", () => {
    const { devices } = mapMatterNode("m", node({
      "0/40/5": "Front door", "1/29/0": [{ "0": 10, "1": 1 }], "1/257/0": 1,
    }));
    expect(devices).toEqual([expect.objectContaining({ id: "m:4/1", kind: "lock", name: "Front door", state: "locked" })]);

    const sensor = mapMatterNode("m", node({ "0/40/5": "Back door", "1/29/0": [{ "0": 21, "1": 1 }], "1/69/0": false, "1/47/12": 170 })).devices;
    expect(sensor).toEqual([
      expect.objectContaining({ id: "m:4/1/state", kind: "binary_sensor", sensorClass: "door", active: true, name: "Back door" }),
      expect.objectContaining({ id: "m:4/1/battery", kind: "sensor", sensorClass: "battery", value: 85, name: "Back door battery" }),
    ]);

    const [garage] = mapMatterNode("m", node({ "0/40/5": "Garage door", "1/29/0": [{ "0": 514, "1": 1 }], "1/258/14": 10000, "1/258/10": 0, "1/258/65532": 5 })).devices;
    expect(garage).toMatchObject({ kind: "cover", coverClass: "garage", state: "closed", position: 0, canSetPosition: true });
  });

  it("reads temperature and humidity together, and names cameras it cannot stream", () => {
    const climate = mapMatterNode("m", node({ "0/40/5": "Hallway", "1/1026/0": 2134, "2/1029/0": 4512 })).devices;
    expect(climate.map(device => device.kind === "sensor" && [device.sensorClass, device.value])).toEqual([["temperature", 21.34], ["humidity", 45.12]]);
    const [camera] = mapMatterNode("m", node({ "0/40/5": "Porch camera", "1/1361/0": 1 })).devices;
    expect(camera).toMatchObject({ kind: "camera", streamable: false });
  });

  it("reports endpoints it cannot map by device type", () => {
    expect(mapMatterNode("m", node({ "1/29/0": [{ "0": 0x0076, "1": 1 }], "1/92/0": 0 })).unsupported).toEqual(["smoke alarm"]);
  });

  it("maps fans from fan mode and percent", () => {
    const [fan] = mapMatterNode("m", node({ "1/29/0": [{ "0": 43, "1": 1 }], "1/514/0": 2, "1/514/2": 60, "1/514/3": 55 })).devices;
    expect(fan).toMatchObject({ kind: "fan", on: true, adjustable: true, speed: 55 });
  });
});
