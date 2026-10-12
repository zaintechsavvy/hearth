"use client";

import { Leaf, Package, Recycle, Settings2, Trash2, TreePine, Wine, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import type { ItemData } from "@/lib/widgets/items";
import { groupPickups, pickupWords } from "@/lib/widgets/schedules";
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./bins-tile.module.css";

export const BIN_ICON_COMPONENTS: Record<ItemData<"bin">["icon"], LucideIcon> = { trash: Trash2, recycle: Recycle, leaf: Leaf, package: Package, wine: Wine, tree: TreePine };

const CARDS: Record<string, number> = { "2x1": 2, "4x1": 3, "2x2": 2 };

/**
 * When the bins go out. Bins collected the same day share one card ("Garbage and recycling, tomorrow"); bins on
 * different days get a card each, so a split week reads as two tiles side by side.
 */
export function BinsTile({ tile, items, interactive, onManage }: HouseholdTileProps<"bin">) {
  const now = useMinute();
  if (items.length === 0) return <SetupTile icon="recycle" title="Set up bin day" hint="Trash, recycling, compost" tone="#22c55e" onClick={() => onManage()} interactive={interactive} wide={tile.size !== "2x2"} />;
  if (now === null) return <div className={`${glassClass("panel")} ${styles.card}`} />;
  const groups = groupPickups(items, new Date(now)).slice(0, CARDS[tile.size] ?? 2);
  return (
    <div className={styles.cards} data-size={tile.size} data-count={groups.length}>
      {groups.map((group, index) => {
        const words = pickupWords(group.days, new Date(now));
        const urgent = group.days <= 1;
        const names = group.bins.map(bin => bin.data.name);
        const label = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)?.toLowerCase()}` : names[0];
        const date = new Date(`${group.date}T12:00`);
        return (
          <button key={group.date} type="button" className={`${glassClass("panel")} ${styles.card}`} data-urgent={urgent || undefined} data-first={index === 0 || undefined}
            style={{ "--bin": group.bins[0].data.color } as CSSProperties} onClick={() => onManage()} disabled={!interactive} aria-label={`${label}: ${words}, ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}>
            <span className={styles.icons} aria-hidden="true">
              {group.bins.map(bin => {
                const Icon = BIN_ICON_COMPONENTS[bin.data.icon];
                return <span key={bin.id} className={styles.icon} style={{ "--bin": bin.data.color } as CSSProperties}><Icon size={18} strokeWidth={1.9} /></span>;
              })}
            </span>
            <span className={styles.text}>
              <span className={styles.when}>{words}</span>
              <span className={styles.what}>{label}</span>
            </span>
            {group.days > 1 && (
              <span className={styles.count} aria-hidden="true">
                <b>{group.days}</b>
                <small>{date.toLocaleDateString(undefined, { weekday: "short" })}</small>
              </span>
            )}
          </button>
        );
      })}
      {interactive && (
        <button type="button" className={`${glassClass("pill")} ${styles.manage}`} onClick={() => onManage()} aria-label="Edit bins and pickup days"><Settings2 size={14} strokeWidth={1.75} aria-hidden="true" /></button>
      )}
    </div>
  );
}
