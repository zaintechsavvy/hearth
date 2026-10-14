import { describe, expect, it } from "vitest";
import { checkPin, hashPin } from "./security";

describe("checkPin", () => {
  it("accepts the PIN and refuses others", () => {
    const settings = { method: "pin" as const, ...hashPin("2468") };
    expect(checkPin("home-a", settings, "2468")).toBe("ok");
    expect(checkPin("home-a", settings, "1111")).toBe("wrong");
    expect(checkPin("home-a", settings, null)).toBe("missing");
  });

  it("locks after five wrong tries", () => {
    const settings = { method: "pin" as const, ...hashPin("2468") };
    for (let i = 0; i < 5; i++) checkPin("home-b", settings, "0000");
    expect(checkPin("home-b", settings, "2468")).toBe("locked");
  });
});
