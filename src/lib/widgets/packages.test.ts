import { describe, expect, it } from "vitest";
import { ITEM_SCHEMAS } from "./items";
import { detectCarrier, followable, packageSource, packageStatus, shownPackages, trackerSaysArrived, trackingUrl } from "./packages";

const pkg = (patch: Record<string, unknown>) => ITEM_SCHEMAS.package.parse({ name: "Headphones", ...patch });
const now = new Date("2026-10-14T10:00:00");

describe("detectCarrier", () => {
  it("knows the common shapes", () => {
    expect(detectCarrier("TBA123456789012")).toBe("amazon");
    expect(detectCarrier("1Z999AA10123456784")).toBe("ups");
    expect(detectCarrier("7023 2100 0123 4567")).toBe("canada-post");
    expect(detectCarrier("RR123456789CA")).toBe("canada-post");
    expect(detectCarrier("9400111899223197428490")).toBe("usps");
    expect(detectCarrier("123456789012")).toBeNull();
  });

  it("links to the carrier, or a universal tracker", () => {
    expect(trackingUrl("amazon", "TBA123456789012")).toBe("https://track.amazon.com/tracking/TBA123456789012");
    expect(trackingUrl("other", "AB 12")).toBe("https://t.17track.net/en#nums=AB12");
  });
});

describe("packageStatus", () => {
  it("says when it arrives and nudges to collect", () => {
    expect(packageStatus(pkg({ expected: "2026-10-14" }), now)).toEqual({ mood: "today", words: "Arriving today" });
    expect(packageStatus(pkg({ expected: "2026-10-15" }), now).words).toBe("Arriving tomorrow");
    expect(packageStatus(pkg({ expected: "2026-10-12" }), now).mood).toBe("late");
    expect(packageStatus(pkg({}), now).words).toBe("On the way");
    expect(packageStatus(pkg({ status: "delivered", deliveredAt: now.toISOString() }), now)).toEqual({ mood: "collect", words: "Delivered, collect it" });
  });

  it("puts packages to collect first and lets collected ones go after a day", () => {
    const items = [
      { id: "a", data: pkg({ expected: "2026-10-20" }) },
      { id: "b", data: pkg({ status: "delivered", deliveredAt: now.toISOString() }) },
      { id: "c", data: pkg({ status: "collected", collectedAt: "2026-10-10T10:00:00Z" }) },
    ];
    expect(shownPackages(items, now).map(entry => entry.item.id)).toEqual(["b", "a"]);
  });
});

describe("trackers", () => {
  it("reads arrival from 17TRACK statuses", () => {
    expect(trackerSaysArrived("Delivered")).toBe(true);
    expect(trackerSaysArrived("Ready to be Picked Up")).toBe(true);
    expect(trackerSaysArrived("Undelivered")).toBe(false);
    expect(trackerSaysArrived("In Transit")).toBe(false);
  });

  it("follows numbered packages that are not Amazon's own", () => {
    expect(followable(pkg({ tracking: "RR123456789CA", carrier: "canada-post" }))).toBe(true);
    expect(followable(pkg({ tracking: "TBA123456789012", carrier: "amazon" }))).toBe(false);
    expect(followable(pkg({ tracking: "" }))).toBe(false);
  });
});

describe("packageSource", () => {
  it("names the shop once, and the carrier when it differs", () => {
    expect(packageSource({ from: "Amazon", carrier: "amazon" })).toBe("Amazon");
    expect(packageSource({ from: "Best Buy", carrier: "purolator" })).toBe("Best Buy via Purolator");
    expect(packageSource({ from: "", carrier: "other" })).toBe("");
  });
});
