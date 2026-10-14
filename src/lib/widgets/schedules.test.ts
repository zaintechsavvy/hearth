import { describe, expect, it } from "vitest";
import { applyTimerControl, countdownDays, doseSlots, formatDuration, groupPickups, nextPickup, pickupWords, plantThirst, wifiQrText } from "./schedules";

const bin = (weekday: number, every: 1 | 2 | 4, start: string) => ({ name: "Bin", color: "#000000", icon: "trash" as const, weekday, every, start });

describe("bin day", () => {
  const monday = new Date("2026-10-12T10:00:00");
  it("finds the next weekly collection", () => {
    expect(nextPickup(bin(3, 1, "2026-01-01"), monday)).toBe("2026-10-14");
    expect(nextPickup(bin(1, 1, "2026-01-01"), monday)).toBe("2026-10-12");
  });

  it("keeps fortnightly collections in step with their start", () => {
    expect(nextPickup(bin(3, 2, "2026-10-07"), monday)).toBe("2026-10-21");
    expect(nextPickup(bin(3, 2, "2026-10-14"), monday)).toBe("2026-10-14");
  });

  it("groups bins that go out together", () => {
    const groups = groupPickups([{ id: "a", data: bin(3, 1, "2026-01-01") }, { id: "b", data: bin(3, 2, "2026-10-14") }, { id: "c", data: bin(5, 1, "2026-01-01") }], monday);
    expect(groups.map(group => [group.date, group.days, group.bins.map(item => item.id)])).toEqual([["2026-10-14", 2, ["a", "b"]], ["2026-10-16", 4, ["c"]]]);
  });

  it("says put out tonight the evening before", () => {
    expect(pickupWords(1, new Date("2026-10-12T18:30:00"))).toBe("Put out tonight");
    expect(pickupWords(1, new Date("2026-10-12T09:00:00"))).toBe("Tomorrow");
  });
});

describe("medication", () => {
  const med = { name: "Metformin", dose: "", person: "", times: ["20:00", "08:00"], weekdays: [], color: "#000000", supply: null, taken: { "2026-10-12 08:00": "2026-10-12T08:04:00.000Z" } };
  it("lists today's doses with their state", () => {
    expect(doseSlots(med, new Date("2026-10-12T19:45:00")).map(slot => [slot.time, slot.state])).toEqual([["08:00", "taken"], ["20:00", "due"]]);
    expect(doseSlots(med, new Date("2026-10-12T21:30:00"))[1].state).toBe("missed");
    expect(doseSlots(med, new Date("2026-10-12T12:00:00"))[1].state).toBe("upcoming");
  });

  it("leaves out doses that were over before the medication was added", () => {
    expect(doseSlots({ ...med, taken: {} }, new Date("2026-10-12T15:00:00"), new Date("2026-10-12T14:00:00").toISOString()).map(slot => slot.time)).toEqual(["20:00"]);
  });

  it("skips days it is not taken", () => {
    expect(doseSlots({ ...med, weekdays: [2] }, new Date("2026-10-12T12:00:00"))).toEqual([]);
  });
});

describe("countdowns, plants, timers, and Wi-Fi", () => {
  it("rolls yearly countdowns over", () => {
    expect(countdownDays({ title: "Birthday", date: "1990-10-10", emoji: "", color: "#000000", yearly: true }, new Date("2026-10-12T09:00:00")).days).toBe(363);
    expect(countdownDays({ title: "Trip", date: "2026-10-24", emoji: "", color: "#000000", yearly: false }, new Date("2026-10-12T23:00:00")).days).toBe(12);
  });

  it("measures thirst", () => {
    expect(plantThirst({ name: "Fern", emoji: "", everyDays: 4, lastWatered: "2026-10-10T09:00:00", place: "" }, new Date("2026-10-12T09:00:00"))).toEqual({ since: 2, left: 2, level: 0.5 });
  });

  it("formats durations", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });

  it("escapes Wi-Fi QR text", () => {
    expect(wifiQrText({ ssid: "Home;Net", password: "p:ss", security: "WPA", hidden: false })).toBe("WIFI:T:WPA;S:Home\\;Net;P:p\\:ss;;");
    expect(wifiQrText({ ssid: "a\\b", password: "", security: "nopass", hidden: true })).toBe("WIFI:T:nopass;S:a\\\\b;H:true;;");
  });
});

describe("wall tablet night", async () => {
  const { isNight } = await import("@/lib/wall");
  it("handles windows that cross midnight", () => {
    const window = { dimFrom: "22:00", dimTo: "07:00" };
    expect(isNight(window, new Date("2026-10-12T23:30:00"))).toBe(true);
    expect(isNight(window, new Date("2026-10-12T06:59:00"))).toBe(true);
    expect(isNight(window, new Date("2026-10-12T07:00:00"))).toBe(false);
    expect(isNight({ dimFrom: "13:00", dimTo: "15:00" }, new Date("2026-10-12T14:00:00"))).toBe(true);
  });
});

describe("history downsampling", async () => {
  const { downsample } = await import("@/lib/downsample");
  it("averages into buckets", () => {
    const points = Array.from({ length: 1000 }, (_, index) => ({ t: index, v: index % 2 }));
    const shown = downsample(points, 0, 1000, 10);
    expect(shown).toHaveLength(10);
    expect(shown.every(point => point.v === 0.5)).toBe(true);
  });
});

describe("applyTimerControl", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  const timer = { label: "Pasta", durationMs: 600_000, remainingMs: 600_000, endsAt: null };
  it("starts, pauses with what is left, and resumes from there", () => {
    const running = applyTimerControl(timer, { action: "start" }, now);
    expect(running.endsAt).toBe(new Date(now + 600_000).toISOString());
    const paused = applyTimerControl(running, { action: "pause" }, now + 60_000);
    expect(paused).toMatchObject({ endsAt: null, remainingMs: 540_000 });
    expect(applyTimerControl(paused, { action: "start" }, now + 120_000).endsAt).toBe(new Date(now + 660_000).toISOString());
  });

  it("adds a minute, resets, and restarts a finished timer", () => {
    const running = applyTimerControl(timer, { action: "start" }, now);
    expect(applyTimerControl(running, { action: "add", ms: 60_000 }, now).endsAt).toBe(new Date(now + 660_000).toISOString());
    expect(applyTimerControl(running, { action: "reset" }, now)).toMatchObject({ endsAt: null, remainingMs: 600_000 });
    expect(applyTimerControl(running, { action: "restart" }, now + 700_000).endsAt).toBe(new Date(now + 1_300_000).toISOString());
  });
});
