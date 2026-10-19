export interface Span {
  columns: number;
  rows: number;
}

export interface Cell {
  column: number;
  row: number;
}

/** The column counts the dashboard grid switches between as it narrows. */
export const GRID_COLUMNS = [8, 6, 4] as const;
export type GridColumns = (typeof GRID_COLUMNS)[number];

class Board {
  private taken: boolean[][] = [];
  constructor(private columns: number) {}

  fits({ column, row }: Cell, span: Span) {
    if (column < 0 || row < 0 || column + span.columns > this.columns) return false;
    for (let r = row; r < row + span.rows; r++) for (let c = column; c < column + span.columns; c++) if (this.taken[r]?.[c]) return false;
    return true;
  }

  take({ column, row }: Cell, span: Span) {
    for (let r = row; r < row + span.rows; r++) for (let c = column; c < column + span.columns; c++) (this.taken[r] ??= [])[c] = true;
  }

  /** The free spot nearest `near` that the span fits, top-left first on a tie. With no `near`, the first one from the top-left. */
  nearest(span: Span, near: Cell = { column: 0, row: 0 }) {
    let best: Cell | null = null, distance = Infinity;
    for (let row = 0; row <= this.taken.length + 1; row++) {
      if (Math.abs(row - near.row) > distance) { if (row > near.row) break; continue; }
      for (let column = 0; column + span.columns <= this.columns; column++) {
        const away = Math.abs(row - near.row) + Math.abs(column - near.column);
        if (away < distance && this.fits({ column, row }, span)) [best, distance] = [{ column, row }, away];
      }
    }
    return best ?? { column: 0, row: this.taken.length };
  }

  first(span: Span) {
    for (let row = 0; ; row++) for (let column = 0; column + span.columns <= this.columns; column++) if (this.fits({ column, row }, span)) return { column, row };
  }
}

const within = (span: Span, columns: number) => ({ columns: Math.min(span.columns, columns), rows: span.rows });

/**
 * Where every tile sits at a column count: tiles keep the cell they were put in, earlier ones winning if two now overlap,
 * and the rest fill the first gap from the top-left that fits them, as `grid-auto-flow: dense` would. Gaps can stay.
 */
export function arrange(ids: string[], spanOf: (id: string) => Span, columns: number, placeOf: (id: string) => Cell | undefined = () => undefined) {
  const board = new Board(columns);
  const cells = new Map<string, Cell>();
  for (const id of ids) {
    const place = placeOf(id), span = within(spanOf(id), columns);
    if (place && board.fits(place, span)) {
      board.take(place, span);
      cells.set(id, place);
    }
  }
  for (const id of ids) {
    if (cells.has(id)) continue;
    const span = within(spanOf(id), columns), cell = board.first(span);
    board.take(cell, span);
    cells.set(id, cell);
  }
  return cells;
}

/** `id` dropped at `target`: tiles it covers step aside, into the spot it left when they fit there, otherwise the nearest gap. */
export function moveTo(cells: Map<string, Cell>, id: string, target: Cell, spanOf: (id: string) => Span, columns: number) {
  const span = within(spanOf(id), columns);
  const at = { column: Math.max(0, Math.min(target.column, columns - span.columns)), row: Math.max(0, target.row) };
  const covers = (other: string) => {
    const cell = cells.get(other)!, size = within(spanOf(other), columns);
    return cell.column < at.column + span.columns && at.column < cell.column + size.columns && cell.row < at.row + span.rows && at.row < cell.row + size.rows;
  };
  const board = new Board(columns);
  board.take(at, span);
  const next = new Map<string, Cell>([[id, at]]);
  const covered: string[] = [];
  for (const [other, cell] of cells) {
    if (other === id) continue;
    if (covers(other)) covered.push(other);
    else {
      board.take(cell, within(spanOf(other), columns));
      next.set(other, cell);
    }
  }
  const origin = cells.get(id);
  for (const other of covered) {
    const size = within(spanOf(other), columns);
    const cell = origin && board.fits(origin, size) ? origin : board.nearest(size, cells.get(other));
    board.take(cell, size);
    next.set(other, cell);
  }
  return next;
}

/** Reading order, top row first: how tiles are listed once placed, so a narrower grid without its own places keeps the same sense. */
export const byPosition = (cells: Map<string, Cell>) => (a: string, b: string) => {
  const one = cells.get(a)!, two = cells.get(b)!;
  return one.row - two.row || one.column - two.column;
};
