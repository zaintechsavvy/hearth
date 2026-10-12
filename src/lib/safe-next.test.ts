import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/join/abc")).toBe("/join/abc");
    expect(safeNext("/settings?x=1#alerts")).toBe("/settings?x=1#alerts");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", undefined, ["/a"], "/".repeat(301)]) expect(safeNext(value)).toBeNull();
  });
});
