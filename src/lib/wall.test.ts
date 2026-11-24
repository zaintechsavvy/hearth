import { describe, expect, it } from "vitest";
import { DEFAULT_WALL, restBrightness } from "./wall";

describe("restBrightness", () => {
  it("uses the day brightness by day, the red brightness at night, and dims with the dashboard otherwise", () => {
    const settings = { ...DEFAULT_WALL, clockBrightness: 0.8, dimLevel: 0.5, redBrightness: 0.15 };
    expect(restBrightness(settings, false)).toBe(0.8);
    expect(restBrightness(settings, true)).toBe(0.15);
    expect(restBrightness({ ...settings, nightRed: false }, true)).toBeCloseTo(0.56);
  });
});
