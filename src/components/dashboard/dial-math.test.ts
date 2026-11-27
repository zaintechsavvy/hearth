import { describe, expect, it } from "vitest";
import { angleToValue, arcPath, pointAngle, snap, tickValues, valueToAngle } from "./dial-math";

const celsius = { min: 10, max: 30, step: 0.5 };
const fahrenheit = { min: 45, max: 95, step: 1 };

describe("the thermostat dial", () => {
  it("puts the coolest setting at the bottom left and the warmest at the bottom right", () => {
    expect(valueToAngle(10, celsius)).toBe(-135);
    expect(valueToAngle(20, celsius)).toBe(0);
    expect(valueToAngle(30, celsius)).toBe(135);
    expect(valueToAngle(99, celsius)).toBe(135);
  });

  it("snaps to the device's step without float dust", () => {
    expect(snap(21.26, celsius)).toBe(21.5);
    expect(snap(21.24, celsius)).toBe(21);
    expect(snap(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snap(70.4, fahrenheit)).toBe(70);
    expect(snap(5, celsius)).toBe(10);
  });

  it("reads the angle of a point the way the arc runs, clockwise from the top", () => {
    expect(pointAngle(0, -10)).toBeCloseTo(0);
    expect(pointAngle(10, 0)).toBeCloseTo(90);
    expect(pointAngle(-10, 0)).toBeCloseTo(-90);
  });

  it("turns an angle into a snapped value, and holds at the nearer end in the gap", () => {
    expect(angleToValue(0, celsius, 20)).toBe(20);
    expect(angleToValue(67.5, celsius, 20)).toBe(25);
    expect(angleToValue(1, celsius, 20)).toBe(20);
    expect(angleToValue(170, celsius, 29)).toBe(30);
    expect(angleToValue(-170, celsius, 11)).toBe(10);
    expect(angleToValue(180, celsius, 12)).toBe(10);
  });

  it("draws arcs past a half turn with the large-arc flag", () => {
    expect(arcPath(100, 100, 80, -135, 135)).toBe("M 43.43 156.57 A 80 80 0 1 1 156.57 156.57");
    expect(arcPath(100, 100, 80, -135, 0)).toContain(" 0 0 1 100.00 20.00");
  });

  it("keeps the scale to about a dozen ticks on whole degrees", () => {
    expect(tickValues(celsius)).toEqual([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
    expect(tickValues(fahrenheit)).toEqual([45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
    expect(tickValues({ min: 7, max: 35, step: 0.5 }).length).toBeLessThanOrEqual(13);
  });
});
