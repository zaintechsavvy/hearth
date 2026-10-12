import { describe, expect, it } from "vitest";
import { hexToHs, hsToHex, hsToXy, kelvinToHex, kelvinToMired, miredToKelvin, xyToHs } from "./color";

describe("colour conversions", () => {
  it("round trips hex through hue and saturation", () => {
    expect(hexToHs("#ff0000")).toEqual({ hue: 0, saturation: 100 });
    expect(hexToHs("#0000ff")).toEqual({ hue: 240, saturation: 100 });
    expect(hsToHex({ hue: 120, saturation: 100 })).toBe("#00ff00");
    expect(hsToHex({ hue: 0, saturation: 0 })).toBe("#ffffff");
    expect(hexToHs("not a colour")).toBeNull();
  });

  it("round trips xy for bulbs that only speak CIE", () => {
    const blue = xyToHs(hsToXy({ hue: 240, saturation: 100 }).x, hsToXy({ hue: 240, saturation: 100 }).y);
    expect(Math.abs(blue.hue - 240)).toBeLessThan(3);
    expect(blue.saturation).toBeGreaterThan(95);
  });

  it("converts white temperatures", () => {
    expect(kelvinToMired(2700)).toBe(370);
    expect(miredToKelvin(153)).toBe(6536);
    expect(kelvinToHex(2700)).toMatch(/^#ff[a-f0-9]{4}$/);
  });
});
