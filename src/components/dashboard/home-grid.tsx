"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, SlidersHorizontal } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { glassClass } from "@/components/glass/glass";
import { moveTile, spanOf, type TileConfig } from "@/lib/dashboard/layout";
import styles from "./home-grid.module.css";

interface HomeGridProps {
  tiles: TileConfig[];
  editing: boolean;
  renderTile: (tile: TileConfig) => ReactNode;
  nameOf: (tile: TileConfig) => string;
  onTilesChange: (tiles: TileConfig[]) => void;
  onCustomize: (id: string) => void;
}

export function HomeGrid({ tiles, editing, renderTile, nameOf, onTilesChange, onCustomize }: HomeGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = tiles.filter(tile => !tile.hidden);

  function dragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onTilesChange(moveTile(tiles, String(active.id), String(over.id)));
  }

  return (
    <div className={styles.frame}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <SortableContext items={visible.map(tile => tile.id)} strategy={rectSortingStrategy} disabled={!editing}>
          <div className={styles.grid} data-editing={editing || undefined}>
            {visible.map((tile, index) => (
              <SortableTile key={tile.id} tile={tile} index={index} editing={editing} name={nameOf(tile)}
                onHide={() => onTilesChange(tiles.map(item => item.id === tile.id ? { ...item, hidden: true } : item))}
                onCustomize={() => onCustomize(tile.id)}>
                {renderTile(tile)}
              </SortableTile>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableTileProps {
  tile: TileConfig;
  index: number;
  editing: boolean;
  name: string;
  onHide: () => void;
  onCustomize: () => void;
  children: ReactNode;
}

function SortableTile({ tile, index, editing, name, onHide, onCustomize, children }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id, disabled: !editing });
  const { columns, rows } = spanOf(tile.size);
  const style: CSSProperties = {
    gridColumn: `span ${columns}`,
    gridRow: `span ${rows}`,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.cell}
      data-dragging={isDragging || undefined}
      data-wobble={editing ? (index % 2 ? "b" : "a") : undefined}
      {...(editing ? { ...attributes, ...listeners, "aria-roledescription": "Movable tile", "aria-label": `${name}. Press space to move.` } : {})}
    >
      <div className={styles.content} inert={editing || undefined}>{children}</div>
      {editing && (
        <div className={styles.controls}>
          <button type="button" className={`${glassClass("pill")} ${styles.control}`} onClick={onHide} aria-label={`Hide ${name}`}>
            <EyeOff size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className={`${glassClass("pill")} ${styles.control}`} onClick={onCustomize} aria-label={`Customize ${name}`}>
            <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
