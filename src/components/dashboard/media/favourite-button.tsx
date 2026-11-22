"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useHome } from "@/components/dashboard/use-home";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { itemsOf } from "@/lib/widgets/items";
import styles from "./media-tile.module.css";

/** The heart saves what is playing, so it can be played again later from any player. */
export function FavouriteButton({ device, disabled }: { device: MediaPlayerDevice; disabled: boolean }) {
  const { home, saveItem, removeItem } = useHome();
  const [pending, setPending] = useState<boolean | null>(null);
  const media = device.media;
  if (!media || !device.can.play || !device.title) return null;
  const saved = itemsOf(home?.widgets ?? [], "favorite").find(item => item.data.contentId === media.id);
  const on = pending ?? Boolean(saved);
  const toggle = async () => {
    setPending(!on);
    if (saved) await removeItem(saved.id);
    else await saveItem("favorite", { title: device.title, artist: device.artist ?? "", contentId: media.id, contentType: media.type });
    setPending(null);
  };
  return (
    <button type="button" className={styles.heart} data-on={on || undefined} aria-pressed={on} aria-label={on ? `Remove ${device.title} from favourites` : `Add ${device.title} to favourites`} disabled={disabled} onClick={() => void toggle()}>
      <Heart size={20} strokeWidth={1.75} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
