"use client";

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { SlidersHorizontal } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { glassClass } from "@/components/glass/glass";
import { haptic } from "@/lib/haptics";
import { spanOf, type TileConfig } from "@/lib/dashboard/layout";
import styles from "./home-grid.module.css";

interface HomeGridProps {
  tiles: TileConfig[];
  editing: boolean;
  renderTile: (tile: TileConfig) => ReactNode;
  nameOf: (tile: TileConfig) => string;
  onTilesChange: (tiles: TileConfig[]) => void;
  onCustomize: (id: string) => void;
}

/** Tiles stay where the grid puts them; the order changes while dragging, so the preview is the real layout at real sizes. */
const noShift = () => null;
/** Whatever is under the finger, or the nearest tile when it is over a gap. */
const underPointer: CollisionDetection = args => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};
/** A tile that just moved needs a moment before it can move again, or two tiles of different sizes swap back and forth. */
const SETTLE_MS = 120;

function move(ids: string[], from: string, to: string) {
  const start = ids.indexOf(from);
  const end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return ids;
  const next = [...ids];
  next.splice(end, 0, ...next.splice(start, 1));
  return next;
}

export function HomeGrid({ tiles, editing, renderTile, nameOf, onTilesChange, onCustomize }: HomeGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [order, setOrder] = useState<string[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const moved = useRef(0);
  const byId = new Map(tiles.map(tile => [tile.id, tile]));
  const shown = order ? order.flatMap(id => byId.get(id) ?? []) : tiles;
  const dragged = active ? byId.get(active) : undefined;

  const start = ({ active: from }: DragStartEvent) => {
    haptic("press");
    setActive(String(from.id));
    setOrder(tiles.map(tile => tile.id));
  };
  const over = ({ active: from, over: target }: DragOverEvent) => {
    if (!target || target.id === from.id || Date.now() - moved.current < SETTLE_MS) return;
    moved.current = Date.now();
    setOrder(current => current && move(current, String(from.id), String(target.id)));
  };
  const end = () => {
    const changed = order && order.some((id, index) => id !== tiles[index]?.id);
    if (changed) {
      haptic("tap");
      onTilesChange(order.flatMap(id => byId.get(id) ?? []));
    }
    setOrder(null);
    setActive(null);
  };
  const cancel = () => {
    setOrder(null);
    setActive(null);
  };

  return (
    <div className={styles.frame}>
      <DndContext sensors={sensors} collisionDetection={underPointer} onDragStart={start} onDragOver={over} onDragEnd={end} onDragCancel={cancel}>
        <SortableContext items={shown.map(tile => tile.id)} strategy={noShift} disabled={!editing}>
          <div className={styles.grid} data-editing={editing || undefined}>
            {shown.map((tile, index) => (
              <SortableTile key={tile.id} tile={tile} index={index} editing={editing} name={nameOf(tile)} held={tile.id === active}
                onCustomize={() => onCustomize(tile.id)}>
                {renderTile(tile)}
              </SortableTile>
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" }}>
          {dragged && <div className={styles.lifted}><div className={styles.content} inert>{renderTile(dragged)}</div></div>}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface SortableTileProps {
  tile: TileConfig;
  index: number;
  editing: boolean;
  name: string;
  /** Being dragged: its place in the grid shows where it will land, at its own size. */
  held: boolean;
  onCustomize: () => void;
  children: ReactNode;
}

function SortableTile({ tile, index, editing, name, held, onCustomize, children }: SortableTileProps) {
  const { attributes, listeners, setNodeRef } = useSortable({ id: tile.id, disabled: !editing });
  const { columns, rows } = spanOf(tile.size);
  const style: CSSProperties = { gridColumn: `span ${columns}`, gridRow: `span ${rows}` };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.cell}
      data-held={held || undefined}
      data-wobble={editing && !held ? (index % 2 ? "b" : "a") : undefined}
      {...(editing ? { ...attributes, ...listeners, "aria-roledescription": "Movable tile", "aria-label": `${name}. Press space to move.` } : {})}
    >
      <div className={styles.content} inert={editing || undefined}>{children}</div>
      {editing && !held && (
        <div className={styles.controls}>
          <button type="button" className={`${glassClass("pill")} ${styles.control}`} onClick={onCustomize} aria-label={`Customize ${name}`}>
            <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
