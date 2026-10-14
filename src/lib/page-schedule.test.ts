import { describe, expect, it } from "vitest";
import { activeRule, inWindow } from "./page-schedule";

describe("page schedule", () => {
  it("handles windows past midnight", () => {
    expect(inWindow("22:00", "07:00", new Date("2026-10-14T23:30:00"))).toBe(true);
    expect(inWindow("22:00", "07:00", new Date("2026-10-14T06:59:00"))).toBe(true);
    expect(inWindow("22:00", "07:00", new Date("2026-10-14T12:00:00"))).toBe(false);
    expect(inWindow("07:00", "09:00", new Date("2026-10-14T08:00:00"))).toBe(true);
  });

  it("skips rules for pages that are gone", () => {
    const rules = [{ id: "a", pageId: "gone", from: "00:00", to: "23:59" }, { id: "b", pageId: "night", from: "00:00", to: "23:59" }];
    expect(activeRule(rules, ["home", "night"], new Date("2026-10-14T12:00:00"))?.id).toBe("b");
  });
});
