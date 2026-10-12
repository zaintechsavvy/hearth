"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassSheetClass } from "@/components/glass/glass";
import { SIZE_OPTIONS, spanOf, TILE_COLORS, TILE_ICONS, type TileColor, type TileConfig, type TileIcon, type TileKind, type TileSize } from "@/lib/dashboard/layout";
import { TILE_ICON_COMPONENTS, iconLabel } from "./tiles/tile-icons";
import styles from "./tile-editor.module.css";

export interface EditableTile {
  config: TileConfig;
  kind: TileKind;
  name: string;
  adjustable: boolean;
  icon: TileIcon | null;
  color: TileColor | null;
}

interface TileEditorProps {
  tile: EditableTile | null;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<Omit<TileConfig, "id">>) => void;
  /** Renders the real tile for a config, without side effects such as opening a camera stream. */
  renderPreview: (config: TileConfig) => ReactNode;
  /** Extra actions for this kind of tile, such as editing a scene. */
  extra?: ReactNode;
}

interface Preview {
  size?: TileSize;
  icon?: TileIcon;
  color?: TileColor;
}

const SIZE_NOTES: Partial<Record<TileSize, string>> = {
  "1x1": "Tap to switch",
  "2x1": "Name and status",
  "1x2": "Vertical slider",
  "2x2": "Details and slider",
  "3x3": "Room for every control",
  "4x2": "Panoramic",
  "4x3": "Big picture",
};

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function TileEditor({ tile, onOpenChange, onChange, renderPreview, extra }: TileEditorProps) {
  const [preview, setPreview] = useState<Preview>({});
  const styled = tile && tile.icon !== null;
  const options = tile ? SIZE_OPTIONS[tile.kind] : [];
  const blocked = (size: TileSize) => (size === "1x2" || size === "2x2") && !tile?.adjustable;
  const shown: TileConfig | null = tile && {
    ...tile.config,
    size: preview.size ?? tile.config.size,
    icon: preview.icon ?? tile.icon ?? undefined,
    color: preview.color ?? tile.color ?? undefined,
  };
  const previewing = Boolean(preview.size || preview.icon || preview.color);
  const close = (open: boolean) => {
    if (!open) setPreview({});
    onOpenChange(open);
  };

  return (
    <Dialog open={Boolean(tile)} onOpenChange={close}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={tile ? `Customize ${tile.name}` : "Customize"} description="Point at an option to preview it, choose it to keep it.">
        {tile && shown && (
          <div className={styles.body}>
            <TilePreview config={shown} label={previewing ? "Previewing" : "Current"}>{renderPreview(shown)}</TilePreview>
            <div className={styles.options}>
            <section aria-labelledby="tile-size" className={styles.section}>
              <h3 id="tile-size" className={styles.heading}>Template</h3>
              <div
                onPointerOver={event => {
                  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card]");
                  const size = card ? options[Number(card.dataset.card)]?.size : undefined;
                  if (size && !blocked(size)) setPreview(current => ({ ...current, size }));
                }}
                onPointerLeave={() => setPreview(current => ({ ...current, size: undefined }))}
              >
                <RadioCards
                  aria-labelledby="tile-size"
                  minColumnWidth={140}
                  value={tile.config.size}
                  onValueChange={size => onChange({ size: size as TileSize })}
                  options={options.map(option => ({
                    value: option.size,
                    label: option.label,
                    meta: option.size.replace("x", "×"),
                    description: SIZE_NOTES[option.size],
                    disabled: blocked(option.size),
                    disabledReason: blocked(option.size) ? "Needs a dimmable light or a fan with speeds" : undefined,
                  }))}
                />
              </div>
            </section>
            {styled && (
              <>
                <section aria-labelledby="tile-icon" className={styles.section}>
                  <h3 id="tile-icon" className={styles.heading}>Icon</h3>
                  <div role="radiogroup" aria-labelledby="tile-icon" className={styles.icons}>
                    {TILE_ICONS.map(icon => {
                      const Icon = TILE_ICON_COMPONENTS[icon];
                      return (
                        <button key={icon} type="button" role="radio" aria-checked={tile.icon === icon} aria-label={iconLabel(icon)} title={iconLabel(icon)} className={styles.iconOption}
                          onClick={() => onChange({ icon })} onPointerEnter={() => setPreview(current => ({ ...current, icon }))} onPointerLeave={() => setPreview(current => ({ ...current, icon: undefined }))}>
                          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section aria-labelledby="tile-color" className={styles.section}>
                  <h3 id="tile-color" className={styles.heading}>Colour</h3>
                  <div role="radiogroup" aria-labelledby="tile-color" className={styles.colors}>
                    {TILE_COLORS.map(color => (
                      <button key={color} type="button" role="radio" aria-checked={tile.color === color} aria-label={capitalize(color)} title={capitalize(color)} className={styles.colorOption} data-color={color}
                        onClick={() => onChange({ color })} onPointerEnter={() => setPreview(current => ({ ...current, color }))} onPointerLeave={() => setPreview(current => ({ ...current, color: undefined }))} />
                    ))}
                  </div>
                </section>
              </>
            )}
            <div className={styles.actions}>
              <div className={styles.extra}>
                <Button variant="ghost" onClick={() => { onChange({ hidden: true }); close(false); }}>Hide tile</Button>
                {extra}
              </div>
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CELL = 112;
const GAP = 12;
const STAGE_HEIGHT = 260;
const STAGE_WIDTH = 252;

/** The real tile at true grid proportions, scaled to fit the stage so text and controls look exactly as they will. */
function TilePreview({ config, label, children }: { config: TileConfig; label: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const { columns, rows } = spanOf(config.size);
  const width = columns * CELL + (columns - 1) * GAP;
  const height = rows * CELL + (rows - 1) * GAP;
  const scale = Math.min(1, STAGE_WIDTH / width, STAGE_HEIGHT / height);
  return (
    <figure className={styles.stage} style={{ minHeight: STAGE_HEIGHT + 56 }} aria-label={`${label} tile, ${config.size.replace("x", " by ")}`}>
      <motion.div className={styles.frame} animate={{ width: width * scale, height: height * scale }} initial={false} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
        <div className={styles.scaled} style={{ width, height, transform: `scale(${scale})` }} inert>{children}</div>
      </motion.div>
      <figcaption className={styles.stageLabel}>{label} · {config.size.replace("x", "×")}</figcaption>
    </figure>
  );
}
