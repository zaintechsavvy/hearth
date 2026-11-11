"use client";

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useSensor, useSensors,
  type DragMoveEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { Check, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { glassClass } from "@/components/glass/glass";
import { haptic } from "@/lib/haptics";
import { spanOf, type TileConfig } from "@/lib/dashboard/layout";
import { arrange, byPosition, GRID_COLUMNS, moveTo, type Cell, type GridColumns } from "@/lib/dashboard/placement";
import styles from "./home-grid.module.css";

interface HomeGridProps {
  tiles: TileConfig[];
  editing: boolean;
  /** Tiles sit in the cells they were put in. Off for a filtered view, which packs what it shows from the top. */
  placed?: boolean;
  renderTile: (tile: TileConfig) => ReactNode;
  nameOf: (tile: TileConfig) => string;
  onTilesChange: (tiles: TileConfig[]) => void;
  onCustomize: (id: string) => void;
  /** Select mode: a tap picks a tile instead of customizing it, and nothing can be dragged. */
  selected?: ReadonlySet<string> | null;
  onToggle?: (id: string) => void;
}

interface Metrics {
  columns: GridColumns;
  stepX: number;
  stepY: number;
}

function measure(grid: HTMLElement): Metrics {
  const style = getComputedStyle(grid), { width } = grid.getBoundingClientRect();
  const count = style.gridTemplateColumns.split(" ").length;
  const columns = GRID_COLUMNS.find(option => option === count) ?? 4;
  const columnGap = parseFloat(style.columnGap) || 0, rowGap = parseFloat(style.rowGap) || 0;
  return { columns, stepX: (width + columnGap) / columns, stepY: (parseFloat(style.gridAutoRows) || 0) + rowGap };
}

/** On a wall tablet, the height left under the header, so four rows of tiles fit on the screen without scrolling. */
function useFitHeight() {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(document.querySelector("main") ?? document.body).paddingBottom) || 0;
      node.style.setProperty("--fit-height", `${Math.max(240, window.innerHeight - (node.getBoundingClientRect().top + window.scrollY) - bottom)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    const wall = new MutationObserver(measure);
    wall.observe(document.documentElement, { attributes: true, attributeFilter: ["data-wall"] });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      wall.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return frame;
}

export function HomeGrid({ tiles, editing, placed = true, renderTile, nameOf, onTilesChange, onCustomize, selected = null, onToggle }: HomeGridProps) {
  const frame = useFitHeight();
  const grid = useRef<HTMLDivElement>(null);
  const metrics = useRef<Metrics | null>(null);
  const byCell: KeyboardCoordinateGetter = (event, { currentCoordinates: { x, y } }) => {
    const step = metrics.current;
    if (!step) return undefined;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.code];
    if (!move) return undefined;
    event.preventDefault();
    return { x: x + move[0] * step.stepX, y: y + move[1] * step.stepY };
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: byCell }),
  );
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ columns: GridColumns; cells: Map<string, Cell> } | null>(null);
  const target = useRef<string>("");
  const byId = new Map(tiles.map(tile => [tile.id, tile]));
  const dragged = active ? byId.get(active) : undefined;
  const layouts = useMemo(() => {
    const ids = tiles.map(tile => tile.id), sizes = new Map(tiles.map(tile => [tile.id, spanOf(tile.size)]));
    const places = new Map(tiles.map(tile => [tile.id, tile.at]));
    return new Map(GRID_COLUMNS.map(columns => [columns, arrange(ids, id => sizes.get(id)!, columns, placed ? id => places.get(id)?.[columns] : undefined)]));
  }, [tiles, placed]);
  const sizeOf = (id: string) => spanOf(byId.get(id)?.size ?? "1x1");

  const start = ({ active: from }: DragStartEvent) => {
    if (!grid.current) return;
    haptic("press");
    metrics.current = measure(grid.current);
    target.current = "";
    setActive(String(from.id));
  };
  const move = ({ active: from }: DragMoveEvent) => {
    const step = metrics.current, box = from.rect.current.translated, origin = grid.current?.getBoundingClientRect();
    if (!step || !box || !origin) return;
    const cell = { column: Math.round((box.left - origin.left) / step.stepX), row: Math.round((box.top - origin.top) / step.stepY) };
    const key = `${cell.column}:${cell.row}`;
    if (key === target.current) return;
    target.current = key;
    setPreview({ columns: step.columns, cells: moveTo(layouts.get(step.columns)!, String(from.id), cell, sizeOf, step.columns) });
  };
  const end = () => {
    if (preview) {
      const before = layouts.get(preview.columns)!, { columns, cells } = preview;
      if ([...cells].some(([id, cell]) => before.get(id)?.column !== cell.column || before.get(id)?.row !== cell.row)) {
        haptic("tap");
        onTilesChange(tiles.map(tile => ({ ...tile, at: { ...tile.at, [columns]: cells.get(tile.id) } })).sort((a, b) => byPosition(cells)(a.id, b.id)));
      }
    }
    cancel();
  };
  const cancel = () => {
    setPreview(null);
    setActive(null);
    metrics.current = null;
  };

  const cellsAt = (columns: GridColumns) => preview?.columns === columns ? preview.cells : layouts.get(columns)!;

  return (
    <div ref={frame} className={styles.frame}>
      <DndContext sensors={sensors} onDragStart={start} onDragMove={move} onDragEnd={end} onDragCancel={cancel}>
        <div ref={grid} className={styles.grid} data-editing={editing || undefined}>
          {tiles.map((tile, index) => (
            <GridTile key={tile.id} tile={tile} index={index} cells={GRID_COLUMNS.map(columns => [columns, cellsAt(columns).get(tile.id)!])}
              editing={editing} name={nameOf(tile)} held={tile.id === active} onCustomize={() => onCustomize(tile.id)}
              picked={selected ? selected.has(tile.id) : null} onToggle={() => onToggle?.(tile.id)}>
              {renderTile(tile)}
            </GridTile>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" }}>
          {dragged && <div className={styles.lifted}><div className={styles.content} inert>{renderTile(dragged)}</div></div>}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface GridTileProps {
  tile: TileConfig;
  index: number;
  /** Its cell at each grid width; CSS picks the one for the width showing. */
  cells: [GridColumns, Cell][];
  editing: boolean;
  name: string;
  /** Being dragged: its place in the grid shows where it will land, at its own size. */
  held: boolean;
  onCustomize: () => void;
  /** In select mode, whether this tile is picked; null outside it. */
  picked: boolean | null;
  onToggle: () => void;
  children: ReactNode;
}

function GridTile({ tile, index, cells, editing, name, held, onCustomize, picked, onToggle, children }: GridTileProps) {
  const selecting = picked !== null;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: tile.id, disabled: !editing || selecting });
  const { columns, rows } = spanOf(tile.size);
  const style = { "--w": columns, "--h": rows } as CSSProperties & Record<string, number>;
  for (const [count, cell] of cells) {
    style[`--col-${count}`] = cell.column + 1;
    style[`--row-${count}`] = cell.row + 1;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.cell}
      data-tile
      data-link={tile.link ?? undefined}
      data-held={held || undefined}
      data-wobble={editing && !held && !selecting ? (index % 2 ? "b" : "a") : undefined}
      data-picked={picked || undefined}
      {...(selecting ? { role: "checkbox", "aria-checked": picked, "aria-label": name, tabIndex: 0, onClick: onToggle, onKeyDown: (event: KeyboardEvent) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onToggle(); } } }
        : editing ? { ...attributes, ...listeners, "aria-roledescription": "Movable tile", "aria-label": `${name}. Press space to move, then the arrow keys.` } : {})}
    >
      <div className={styles.content} inert={editing || undefined}>{children}</div>
      {selecting && (
        <span className={`${glassClass("pill")} ${styles.check}`} aria-hidden="true">{picked && <Check size={16} strokeWidth={2.25} />}</span>
      )}
      {editing && !held && !selecting && (
        <div className={styles.controls}>
          <button type="button" className={`${glassClass("pill")} ${styles.control}`} onClick={onCustomize} aria-label={`Customize ${name}`}>
            <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
