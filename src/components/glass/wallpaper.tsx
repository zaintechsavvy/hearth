"use client";

import dynamic from "next/dynamic";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { usePrefersReducedMotion } from "@/components/shell/use-reduced-motion-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { DEFAULT_WALLPAPER, isMesh, MESH_PALETTES, WALLPAPER_KEY, type Wallpaper as WallpaperName } from "@/lib/theme";
import styles from "./wallpaper.module.css";

const MeshBackdrop = dynamic(() => import("./mesh-backdrop"), { ssr: false });

/**
 * The backdrop behind the glass. Still presets are pure CSS; mesh presets draw a slow Paper Shaders gradient over
 * a CSS approximation of the same palette, which is all that shows before the shader loads or with reduced motion
 * turned on. Presets come from `data-wallpaper` on `<html>`.
 */
export function Wallpaper() {
  const [wallpaper] = useHtmlPreference<WallpaperName>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const theme = useResolvedTheme();
  const still = usePrefersReducedMotion();
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      {isMesh(wallpaper) && <MeshBackdrop key={`${wallpaper}-${theme}`} colors={MESH_PALETTES[wallpaper][theme]} still={still} />}
      <span className={styles.light} />
      <span className={styles.veil} />
      <span className={styles.grain} />
    </div>
  );
}
