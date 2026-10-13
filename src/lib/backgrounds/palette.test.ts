import { describe, expect, it } from "vitest";
import { backdropIsDark, darkenForNight, hexToHsl, hslToHex, luminance, paletteFromPixels, shufflePalette } from "./palette";

describe("palette helpers", () => {
  it("round trips hsl", () => {
    expect(hslToHex(...hexToHsl("#3a86ff"))).toBe("#3a86ff");
  });

  it("shuffles a deep shade over a light one of the same colour", () => {
    let seed = 0.42;
    const [top, bottom] = shufflePalette(() => (seed = (seed * 9301 + 49297) % 233280 / 233280));
    expect(hexToHsl(top)[2]).toBeLessThan(0.3);
    expect(hexToHsl(bottom)[2]).toBeGreaterThan(0.7);
    expect(Math.abs(hexToHsl(top)[0] - hexToHsl(bottom)[0]) % 360).toBeLessThan(13);
  });

  it("measures luminance", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
  });

  it("calls a navy to sky gradient dark and a pastel one light", () => {
    expect(backdropIsDark(["#0f2a5c", "#7fb2f0"], "smooth")).toBe(true);
    expect(backdropIsDark(["#e0c3fc", "#8ec5fc"], "smooth")).toBe(false);
    expect(backdropIsDark(["#e3f3df", "#cbe9da"], "flowing")).toBe(false);
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
