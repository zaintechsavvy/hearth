"use client";

import { Button } from "@/components/arc/button/button";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import styles from "./hidden-tiles-drawer.module.css";

interface HiddenTilesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiles: TileConfig[];
  nameOf: (tile: TileConfig) => string;
  onShow: (id: string) => void;
}

export function HiddenTilesDrawer({ open, onOpenChange, tiles, nameOf, onShow }: HiddenTilesDrawerProps) {
  const hidden = tiles.filter(tile => tile.hidden);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={glassSheetClass} title="Hidden tiles" description="Bring a device or camera back to the dashboard.">
        {hidden.length === 0 ? (
          <EmptyState title="Nothing hidden" description="Hide a tile from its edit controls and it will wait here." />
        ) : (
          <ul className={styles.list}>
            {hidden.map(tile => (
              <li key={tile.id} className={styles.row}>
                <span className={styles.name}>{nameOf(tile)}</span>
                <Button variant="secondary" size="sm" onClick={() => onShow(tile.id)}>Show</Button>
              </li>
            ))}
          </ul>
        )}
      </DrawerContent>
    </Drawer>
  );
}
