import { describe, expect, it } from "vitest";
import { sunProgress } from "./daylight";

const at = (hours: number, minutes = 0) => new Date(2026, 5, 1, hours, minutes);

describe("sunProgress", () => {
  const rise = at(6), set = at(18);
  it("runs across the day while the sun is up", () => {
    expect(sunProgress(at(6), rise, set)).toEqual({ up: true, progress: 0, left: 720 });
    expect(sunProgress(at(12), rise, set)).toEqual({ up: true, progress: 0.5, left: 360 });
  });

  it("runs across the night either side of midnight", () => {
    expect(sunProgress(at(18), rise, set)).toEqual({ up: false, progress: 0, left: 720 });
    expect(sunProgress(at(0), rise, set)).toEqual({ up: false, progress: 0.5, left: 360 });
    expect(sunProgress(at(3), rise, set).progress).toBeCloseTo(0.75);
  });
});
