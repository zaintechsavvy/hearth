"use client";

import { Link2 } from "lucide-react";
import { glassClass } from "@/components/glass/glass";
import { KIND_INFO } from "@/lib/dashboard/catalog";
import type { TileConfig } from "@/lib/dashboard/layout";
import { TILE_ICON_COMPONENTS } from "./tile-icons";
import styles from "./placeholder-tile.module.css";

interface PlaceholderTileProps {
  tile: TileConfig;
  /** The link points at something that is gone, rather than nothing yet. */
  missing: boolean;
  onLink: () => void;
  interactive?: boolean;
}

/** A tile that is not showing anything yet: tap it to choose the device it stands for. */
export function PlaceholderTile({ tile, missing, onLink, interactive = true }: PlaceholderTileProps) {
  const info = KIND_INFO[tile.kind];
  const Icon = TILE_ICON_COMPONENTS[tile.icon ?? info.icon];
  const compact = tile.size === "1x1";
  return (
    <button type="button" className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} onClick={onLink} disabled={!interactive} aria-label={`${tile.label ?? info.label}: ${missing ? "the linked device is gone, choose another" : "choose what it shows"}`}>
      <span className={styles.icon} aria-hidden="true"><Icon size={compact ? 24 : 22} strokeWidth={1.75} /></span>
      <span className={styles.text}>
        <span className={styles.name}>{tile.label ?? info.label}</span>
        {!compact && <span className={styles.hint}><Link2 size={12} strokeWidth={2} aria-hidden="true" /> {missing ? "Device not found. Link another" : "Tap to link a device"}</span>}
      </span>
    </button>
  );
}
