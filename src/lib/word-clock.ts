/** A letter grid that spells the time to the nearest five minutes; the words in each row read in order. */
export interface WordGrid {
  rows: string[];
  /** Where each word sits: its row, first column, and length. */
  words: Record<WordKey, [row: number, column: number, length: number]>;
}

type Hour = "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight" | "nine" | "ten" | "eleven" | "twelve";
export type WordKey = "it" | "is" | "a" | "quarter" | "twenty" | "fiveMinutes" | "half" | "tenMinutes" | "to" | "past" | "oclock" | Hour;

const HOURS: Hour[] = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];

/** Wide and short, for a screen on its side. */
export const LANDSCAPE_GRID: WordGrid = {
  rows: ["ITLISAQUARTERX", "TWENTYFIVEHALF", "TENRTOPASTNINE", "ONESIXTHREETWO", "FOURFIVESEVENM", "EIGHTELEVENTEN", "TWELVEROCLOCKS"],
  words: {
    it: [0, 0, 2], is: [0, 3, 2], a: [0, 5, 1], quarter: [0, 6, 7], twenty: [1, 0, 6], fiveMinutes: [1, 6, 4], half: [1, 10, 4],
    tenMinutes: [2, 0, 3], to: [2, 4, 2], past: [2, 6, 4], nine: [2, 10, 4], one: [3, 0, 3], six: [3, 3, 3], three: [3, 6, 5], two: [3, 11, 3],
    four: [4, 0, 4], five: [4, 4, 4], seven: [4, 8, 5], eight: [5, 0, 5], eleven: [5, 5, 6], ten: [5, 11, 3], twelve: [6, 0, 6], oclock: [6, 7, 6],
  },
};

/** The classic square-ish word clock, for a screen standing up. */
export const PORTRAIT_GRID: WordGrid = {
  rows: ["ITLISASAMPM", "ACQUARTERDC", "TWENTYFIVEX", "HALFSTENFTO", "PASTERUNINE", "ONESIXTHREE", "FOURFIVETWO", "EIGHTELEVEN", "SEVENTWELVE", "TENSEOCLOCK"],
  words: {
    it: [0, 0, 2], is: [0, 3, 2], a: [1, 0, 1], quarter: [1, 2, 7], twenty: [2, 0, 6], fiveMinutes: [2, 6, 4], half: [3, 0, 4], tenMinutes: [3, 5, 3],
    to: [3, 9, 2], past: [4, 0, 4], nine: [4, 7, 4], one: [5, 0, 3], six: [5, 3, 3], three: [5, 6, 5], four: [6, 0, 4], five: [6, 4, 4], two: [6, 8, 3],
    eight: [7, 0, 5], eleven: [7, 5, 6], seven: [8, 0, 5], twelve: [8, 5, 6], ten: [9, 0, 3], oclock: [9, 5, 6],
  },
};

const MINUTE_WORDS: WordKey[][] = [
  [], ["fiveMinutes", "past"], ["tenMinutes", "past"], ["a", "quarter", "past"], ["twenty", "past"], ["twenty", "fiveMinutes", "past"],
  ["half", "past"], ["twenty", "fiveMinutes", "to"], ["twenty", "to"], ["a", "quarter", "to"], ["tenMinutes", "to"], ["fiveMinutes", "to"],
];

/** The words lit for `date`, and how many minutes past the last five (shown as dots). */
export function wordTime(date: Date) {
  const step = Math.floor(date.getMinutes() / 5);
  const hour = HOURS[(date.getHours() + (step > 6 ? 1 : 0)) % 12];
  const words: WordKey[] = ["it", "is", ...MINUTE_WORDS[step], hour, ...(step === 0 ? ["oclock" as const] : [])];
  return { words, extra: date.getMinutes() % 5 };
}

/** The `row:column` of every lit letter in `grid`. */
export function litCells(grid: WordGrid, words: WordKey[]) {
  const cells = new Set<string>();
  for (const word of words) {
    const [row, column, length] = grid.words[word];
    for (let i = 0; i < length; i++) cells.add(`${row}:${column + i}`);
  }
  return cells;
}
