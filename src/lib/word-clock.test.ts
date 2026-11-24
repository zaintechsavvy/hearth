import { describe, expect, it } from "vitest";
import { LANDSCAPE_GRID, litCells, PORTRAIT_GRID, wordTime, type WordKey } from "./word-clock";

const spelled = (key: WordKey) => ({ fiveMinutes: "FIVE", tenMinutes: "TEN", oclock: "OCLOCK" } as Record<string, string>)[key] ?? key.toUpperCase();
const read = (grid: typeof LANDSCAPE_GRID, words: WordKey[]) =>
  words.map(word => { const [row, column, length] = grid.words[word]; return grid.rows[row].slice(column, column + length); }).join(" ");

describe("word clock", () => {
  for (const [name, grid] of [["landscape", LANDSCAPE_GRID], ["portrait", PORTRAIT_GRID]] as const) {
    it(`spells every word where the ${name} grid says`, () => {
      expect(new Set(grid.rows.map(row => row.length)).size).toBe(1);
      for (const word of Object.keys(grid.words) as WordKey[]) expect(read(grid, [word])).toBe(spelled(word));
    });

    it(`reads in order on the ${name} grid at every five minutes`, () => {
      for (let minute = 0; minute < 24 * 60; minute += 5) {
        const { words } = wordTime(new Date(2026, 0, 1, Math.floor(minute / 60), minute % 60));
        const order = words.map(word => grid.words[word][0] * 100 + grid.words[word][1]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(litCells(grid, words).size).toBe(words.reduce((sum, word) => sum + grid.words[word][2], 0));
      }
    });
  }

  it("says the time the way people do", () => {
    const say = (hours: number, minutes: number) => read(LANDSCAPE_GRID, wordTime(new Date(2026, 0, 1, hours, minutes)).words);
    expect(say(0, 0)).toBe("IT IS TWELVE OCLOCK");
    expect(say(10, 22)).toBe("IT IS TWENTY PAST TEN");
    expect(say(10, 45)).toBe("IT IS A QUARTER TO ELEVEN");
    expect(say(23, 35)).toBe("IT IS TWENTY FIVE TO TWELVE");
    expect(wordTime(new Date(2026, 0, 1, 9, 33)).extra).toBe(3);
  });
});
