import { describe, expect, it } from "vitest";
import { arrange, moveTo, type Span } from "./placement";

const sizes: Record<string, Span> = {
  lock: { columns: 2, rows: 2 },
  wifi: { columns: 2, rows: 1 },
  lampA: { columns: 1, rows: 1 },
  lampB: { columns: 1, rows: 1 },
  wide: { columns: 4, rows: 1 },
};
const spanOf = (id: string) => sizes[id];

describe("placement", () => {
  it("fills gaps from the top-left like grid-auto-flow: dense when nothing is placed", () => {
    const cells = arrange(["lock", "wifi", "lampA", "wide"], spanOf, 4);
    expect(cells.get("lock")).toEqual({ column: 0, row: 0 });
    expect(cells.get("wifi")).toEqual({ column: 2, row: 0 });
    expect(cells.get("lampA")).toEqual({ column: 2, row: 1 });
    expect(cells.get("wide")).toEqual({ column: 0, row: 2 });
  });

  it("keeps placed tiles where they were put, gaps included", () => {
    const places: Record<string, { column: number; row: number }> = { lampA: { column: 0, row: 3 } };
    const cells = arrange(["lock", "lampA", "lampB"], spanOf, 4, id => places[id]);
    expect(cells.get("lampA")).toEqual({ column: 0, row: 3 });
    expect(cells.get("lampB")).toEqual({ column: 2, row: 0 });
  });

  it("drops a small tile beside another into a gap, leaving the rest where they are", () => {
    const start = arrange(["lock", "lampB", "wide"], spanOf, 4, id => ({ lock: { column: 0, row: 0 }, lampB: { column: 3, row: 0 }, wide: { column: 0, row: 2 } })[id]);
    const placed = new Map(start).set("lampA", { column: 0, row: 3 });
    const cells = moveTo(placed, "lampB", { column: 1, row: 3 }, spanOf, 4);
    expect(cells.get("lampB")).toEqual({ column: 1, row: 3 });
    expect(cells.get("lampA")).toEqual({ column: 0, row: 3 });
    expect(cells.get("lock")).toEqual({ column: 0, row: 0 });
    expect(cells.get("wide")).toEqual({ column: 0, row: 2 });
  });

  it("swaps with a tile it covers when that tile fits the spot it left", () => {
    const start = arrange(["lampA", "lampB"], spanOf, 4);
    const cells = moveTo(start, "lampB", { column: 0, row: 0 }, spanOf, 4);
    expect(cells.get("lampB")).toEqual({ column: 0, row: 0 });
    expect(cells.get("lampA")).toEqual({ column: 1, row: 0 });
  });

  it("moves a covered tile to the nearest gap when it does not fit the spot left behind", () => {
    const start = arrange(["lampA", "lock"], spanOf, 4);
    const cells = moveTo(start, "lampA", { column: 1, row: 0 }, spanOf, 4);
    expect(cells.get("lampA")).toEqual({ column: 1, row: 0 });
    expect(cells.get("lock")).toEqual({ column: 2, row: 0 });
  });

  it("keeps a wide tile inside the grid", () => {
    const cells = moveTo(arrange(["wifi"], spanOf, 4), "wifi", { column: 3, row: 1 }, spanOf, 4);
    expect(cells.get("wifi")).toEqual({ column: 2, row: 1 });
  });
});
