import { describe, expect, it } from "vitest";
import { darkenForNight, hexToHsl, hslToHex, paletteFromPixels, shufflePalette } from "./palette";

describe("palette helpers", () => {
  it("round trips hsl", () => {
    expect(hslToHex(...hexToHsl("#3a86ff"))).toBe("#3a86ff");
  });

  it("shuffles four light colours", () => {
    let seed = 0.42;
    const palette = shufflePalette(() => (seed = (seed * 9301 + 49297) % 233280 / 233280));
    expect(palette).toHaveLength(4);
    for (const hex of palette) expect(hexToHsl(hex)[2]).toBeGreaterThan(0.6);
  });

  it("darkens for night", () => {
    expect(hexToHsl(darkenForNight("#ffe5d9"))[2]).toBeLessThan(0.35);
  });

  it("finds the main colours of a picture", () => {
    const pixels = new Uint8ClampedArray(4 * 100);
    for (let index = 0; index < 100; index++) pixels.set(index < 70 ? [20, 120, 220, 255] : [240, 90, 40, 255], index * 4);
    expect(paletteFromPixels(pixels, 2)).toEqual(["#1478dc", "#f05a28"]);
  });
});
