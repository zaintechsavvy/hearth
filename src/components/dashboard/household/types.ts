import type { TileConfig } from "@/lib/dashboard/layout";
import type { ItemKind, WidgetItem } from "@/lib/widgets/items";

export interface HouseholdTileProps<K extends ItemKind> {
  tile: TileConfig;
  items: WidgetItem<K>[];
  interactive: boolean;
  /** Opens the editor for this widget, at one item when given. */
  onManage: (itemId?: string) => void;
}
