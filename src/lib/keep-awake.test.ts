import { describe, expect, it } from "vitest";
import { keepAwakeOf } from "./wall";

describe("keepAwakeOf", () => {
  it("reads the stored choice", () => {
    expect(keepAwakeOf("in-use")).toBe("in-use");
    expect(keepAwakeOf("never")).toBe("never");
    expect(keepAwakeOf("always")).toBe("always");
  });

  it("reads a tablet's old on and off switch", () => {
    expect(keepAwakeOf(true)).toBe("always");
    expect(keepAwakeOf(false)).toBe("never");
  });

  it("keeps the screen on when nothing was stored", () => {
    expect(keepAwakeOf(undefined)).toBe("always");
  });
});
