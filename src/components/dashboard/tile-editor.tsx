"use client";

import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { glassSheetClass } from "@/components/glass/glass";
import { SIZE_OPTIONS, TILE_COLORS, TILE_ICONS, type TileColor, type TileConfig, type TileIcon, type TileKind, type TileSize } from "@/lib/dashboard/layout";
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

export function TileEditor({ tile, onOpenChange, onChange }: TileEditorProps) {
  const styled = tile && tile.icon !== null;
  return (
    <Dialog open={Boolean(tile)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={tile ? `Customize ${tile.name}` : "Customize"} description="Changes apply as you pick them.">
        {tile && (
          <div className={styles.body}>
            <section aria-labelledby="tile-size" className={styles.section}>
              <h3 id="tile-size" className={styles.heading}>Template</h3>
              <RadioCards
                aria-labelledby="tile-size"
                minColumnWidth={140}
                value={tile.config.size}
                onValueChange={size => onChange({ size: size as TileSize })}
                options={SIZE_OPTIONS[tile.kind].map(option => {
                  const needsLevel = (option.size === "1x2" || option.size === "2x2") && !tile.adjustable;
                  return {
                    value: option.size,
                    label: option.label,
                    meta: option.size.replace("x", "×"),
                    description: SIZE_NOTES[option.size],
                    disabled: needsLevel,
                    disabledReason: needsLevel ? "Needs a dimmable light or a fan with speeds" : undefined,
                  };
                })}
              />
            </section>
            {styled && (
              <>
                <section aria-labelledby="tile-icon" className={styles.section}>
                  <h3 id="tile-icon" className={styles.heading}>Icon</h3>
                  <div role="radiogroup" aria-labelledby="tile-icon" className={styles.icons}>
                    {TILE_ICONS.map(icon => {
                      const Icon = TILE_ICON_COMPONENTS[icon];
                      return (
                        <button key={icon} type="button" role="radio" aria-checked={tile.icon === icon} aria-label={iconLabel(icon)} title={iconLabel(icon)} className={styles.iconOption} onClick={() => onChange({ icon })}>
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
                      <button key={color} type="button" role="radio" aria-checked={tile.color === color} aria-label={capitalize(color)} title={capitalize(color)} className={styles.colorOption} data-color={color} onClick={() => onChange({ color })} />
                    ))}
                  </div>
                </section>
              </>
            )}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => { onChange({ hidden: true }); onOpenChange(false); }}>Hide tile</Button>
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
