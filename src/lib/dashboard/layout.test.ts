import { describe, expect, it } from "vitest";
import { moveTile, resolveLayout, type TileSource } from "./layout";

const sources: TileSource[] = [
  { id: "a:light", kind: "light", adjustable: true },
  { id: "a:thermo", kind: "thermostat" },
  { id: "a:plug", kind: "switch" },
  { id: "camera:1", kind: "camera" },
  { id: "a:thermo2", kind: "thermostat" },
];

describe("resolveLayout", () => {
  it("gives new sources defaults, thermostats first, the first one large", () => {
    expect(resolveLayout([], sources)).toEqual([
      { id: "a:thermo", size: "3x3" },
      { id: "a:thermo2", size: "2x2" },
      { id: "a:light", size: "1x2" },
      { id: "a:plug", size: "1x1" },
      { id: "camera:1", size: "4x3" },
    ]);
  });

  it("keeps saved order and settings, drops vanished tiles, and fixes sizes a kind cannot use", () => {
    const saved = [
      { id: "a:plug", size: "1x2" as const, color: "rose" as const },
      { id: "gone", size: "1x1" as const },
      { id: "a:light", size: "2x2" as const, icon: "lamp" as const, hidden: true },
    ];
    const resolved = resolveLayout(saved, sources);
    expect(resolved.slice(0, 2)).toEqual([
      { id: "a:plug", size: "1x1", color: "rose" },
      { id: "a:light", size: "2x2", icon: "lamp", hidden: true },
    ]);
    expect(resolved.map(tile => tile.id)).not.toContain("gone");
    expect(resolved).toHaveLength(5);
  });

  it("ignores duplicate saved entries", () => {
    expect(resolveLayout([{ id: "a:plug", size: "1x1" }, { id: "a:plug", size: "2x1" }], [sources[2]])).toEqual([{ id: "a:plug", size: "1x1" }]);
  });
});

describe("moveTile", () => {
  it("moves a tile to another tile's position", () => {
    const tiles = [{ id: "1", size: "1x1" as const }, { id: "2", size: "1x1" as const }, { id: "3", size: "1x1" as const }];
    expect(moveTile(tiles, "3", "1").map(tile => tile.id)).toEqual(["3", "1", "2"]);
  });
});
