import { describe, expect, it } from "vitest";
import { groupByRoom, matchesSearch, searchTerms } from "./device-search";

const lamp = ["Reading lamp", "Living room", "Light · On"];

describe("matchesSearch", () => {
  it("matches everything when nothing is searched", () => {
    expect(matchesSearch(lamp, searchTerms("  "))).toBe(true);
  });

  it("needs every word, in any field and any order", () => {
    expect(matchesSearch(lamp, searchTerms("living lamp"))).toBe(true);
    expect(matchesSearch(lamp, searchTerms("lamp kitchen"))).toBe(false);
  });

  it("ignores case, accents, and a plural", () => {
    expect(matchesSearch(["Café pendant", null, "Light"], searchTerms("CAFE"))).toBe(true);
    expect(matchesSearch(lamp, searchTerms("lights"))).toBe(true);
    expect(matchesSearch(["Hall", null, "Switch"], searchTerms("switches"))).toBe(true);
  });
});

describe("groupByRoom", () => {
  it("sorts rooms alphabetically with the ones without a room last", () => {
    const items = [{ room: "Office" }, { room: null }, { room: "Bedroom" }, { room: "Office" }];
    expect(groupByRoom(items, item => item.room).map(([room, list]) => [room, list.length])).toEqual([["Bedroom", 1], ["Office", 2], ["No room", 1]]);
  });
});
