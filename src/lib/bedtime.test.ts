import { describe, expect, it } from "vitest";
import type { Device } from "@/lib/devices/types";
import { bedtimeSteps } from "./bedtime";
import { isDark, openThings } from "./left-open";
import { cameraFor } from "./ring-camera";

const base = { integrationId: "ha", room: "Entry", available: true };
const devices: Device[] = [
  { ...base, id: "ha:lock.front", name: "Front door", kind: "lock", state: "unlocked" },
  { ...base, id: "ha:lock.back", name: "Back door", kind: "lock", state: "locked" },
  { ...base, id: "ha:cover.garage", name: "Garage door", kind: "cover", coverClass: "garage", state: "open", position: null, canStop: true, canSetPosition: false },
  { ...base, id: "ha:cover.blind", name: "Blind", kind: "cover", coverClass: "blind", state: "open", position: 100, canStop: true, canSetPosition: true },
  { ...base, id: "ha:light.porch", name: "Porch", kind: "light", on: true, dimmable: false, brightness: 100, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null },
  { ...base, id: "ha:alarm.home", name: "Alarm", kind: "alarm", state: "disarmed", modes: ["home", "away", "night"], codeFormat: null, codeToArm: false },
  { ...base, id: "ha:binary_sensor.window", name: "Kitchen window", kind: "binary_sensor", sensorClass: "window", active: true },
  { ...base, id: "ha:binary_sensor.hall", name: "Hall motion", kind: "binary_sensor", sensorClass: "motion", active: true },
];

describe("bedtimeSteps", () => {
  it("locks, closes the garage, turns lights off, and arms for the night, leaving what is already set", () => {
    expect(bedtimeSteps(devices).map(step => [step.name, step.done])).toEqual([
      ["Front door", "locked"], ["Garage door", "closed"], ["Porch", "turned off"], ["Alarm", "armed for the night"],
    ]);
  });

  it("skips an alarm that needs its code to arm", () => {
    const alarm: Device = { ...base, id: "ha:alarm.code", name: "Alarm", kind: "alarm", state: "disarmed", modes: ["away"], codeFormat: "number", codeToArm: true };
    expect(bedtimeSteps([alarm])[0]).toMatchObject({ command: null, skip: expect.stringContaining("code") });
  });
});

describe("left open", () => {
  it("counts open doors, windows, and garage doors, not motion or blinds", () => {
    expect(openThings(devices).map(device => device.name)).toEqual(["Garage door", "Kitchen window"]);
  });

  it("is dark between sunset and sunrise", () => {
    const sun = { sunrise: "2026-10-16T11:20:00.000Z", sunset: "2026-10-16T22:30:00.000Z" };
    expect(isDark(new Date("2026-10-16T23:00:00.000Z"), sun, false)).toBe(true);
    expect(isDark(new Date("2026-10-16T15:00:00.000Z"), sun, true)).toBe(false);
    expect(isDark(new Date("2026-10-16T15:00:00.000Z"), null, true)).toBe(true);
  });
});

describe("cameraFor", () => {
  const doorbell: Device = { ...base, id: "ha:event.front_door_ding", name: "Front door doorbell", kind: "event", eventClass: "doorbell", last: null };
  const camera = (id: string, name: string, room: string | null): Device => ({ ...base, id, name, room, kind: "camera", streamable: true });
  it("picks the camera that shares the doorbell's room, name, or id", () => {
    expect(cameraFor(doorbell, [camera("ha:camera.backyard", "Backyard", "Garden"), camera("ha:camera.front_door", "Front door", "Entry")])?.id).toBe("ha:camera.front_door");
  });

  it("gives up rather than guess between unrelated cameras", () => {
    expect(cameraFor(doorbell, [camera("ha:camera.backyard", "Backyard", "Garden"), camera("ha:camera.garage", "Garage", "Garage")])).toBeNull();
  });
});
