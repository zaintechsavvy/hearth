import { describe, expect, it } from "vitest";
import { createTile, moveTile, removeTile, resolveLayout, suggestedTiles, withoutOrphanTiles, type SavedTile, type TileSource } from "./layout";

const sources: TileSource[] = [
  { id: "a:light", kind: "light", adjustable: true },
  { id: "a:thermo", kind: "thermostat" },
  { id: "a:plug", kind: "switch" },
  { id: "camera:1", kind: "camera" },
  { id: "a:thermo2", kind: "thermostat" },
  { id: "a:battery", kind: "sensor", hidden: true },
];

describe("resolveLayout", () => {
  it("holds only what was placed, never adding new devices", () => {
    expect(resolveLayout([], sources)).toEqual([]);
    const weather = createTile("weather");
    expect(resolveLayout([weather], sources)).toEqual([weather]);
  });

  it("turns older saved entries into linked tiles and drops hidden ones", () => {
    expect(resolveLayout([
      { id: "a:plug", size: "1x1", color: "rose" },
      { id: "a:light", size: "2x2", hidden: true },
      { id: "gone", size: "1x1" },
    ], sources)).toEqual([{ id: "a:plug", kind: "switch", link: "a:plug", size: "1x1", color: "rose", icon: undefined }]);
  });

  it("keeps placeholders and fixes sizes a kind cannot use", () => {
    const lock = { id: "t1", kind: "lock" as const, link: null, size: "4x3" as const, label: "Front door" };
    expect(resolveLayout([lock], sources)).toEqual([{ ...lock, size: "2x1" }]);
  });
});

describe("suggestedTiles", () => {
  it("suggests what is worth showing, thermostats first, the first one large", () => {
    const tiles = suggestedTiles(sources);
    expect(tiles.map(tile => [tile.link, tile.size])).toEqual([
      ["a:thermo", "3x3"],
      ["a:thermo2", "2x2"],
      ["a:light", "1x2"],
      ["a:plug", "1x1"],
      ["camera:1", "4x3"],
    ]);
    expect(new Set(tiles.map(tile => tile.id)).size).toBe(tiles.length);
  });
});

describe("editing", () => {
  it("moves and removes tiles", () => {
    const [a, b, c] = ["light", "switch", "fan"].map(kind => createTile(kind as "light"));
    expect(moveTile([a, b, c], c.id, a.id).map(tile => tile.id)).toEqual([c.id, a.id, b.id]);
    expect(removeTile([a, b, c], b.id)).toEqual([a, c]);
  });
});

describe("withoutOrphanTiles", () => {
  it("drops tiles of a removed connection and keeps everything else", () => {
    const saved: SavedTile[] = [
      { id: "t1", kind: "light", link: "gone:light.desk", size: "1x1" },
      { id: "t2", kind: "lock", link: "ha:lock.front", size: "2x1" },
      { id: "t3", kind: "camera", link: "camera:42", size: "2x2" },
      { id: "t4", kind: "scene", link: "scene:evening", size: "2x1" },
      { id: "t5", kind: "clock", link: null, size: "2x1" },
      { id: "gone:switch.tv", size: "1x1" },
    ];
    expect(withoutOrphanTiles(saved, new Set(["ha"])).map(tile => tile.id)).toEqual(["t2", "t3", "t4", "t5"]);
  });
});
