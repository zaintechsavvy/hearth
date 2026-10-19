"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { applyGradientVars, applyPhotoVars, clearGradientState, shownColors, styleOf } from "@/components/shell/background-vars";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { usePrefersReducedMotion } from "@/components/shell/use-reduced-motion-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { useStoredJson } from "@/components/shell/use-stored-json";
import {
  DEFAULT_GRADIENT, DEFAULT_WALLPAPER, GRADIENT_KEY, isMesh, MESH_PALETTES, PHOTO_KEY, WALLPAPER_KEY,
  type CustomGradient, type PhotoBackground, type Wallpaper as WallpaperName,
} from "@/lib/theme";
import { usePhotoInk } from "./photo-ink";
import styles from "./wallpaper.module.css";

const MeshBackdrop = dynamic(() => import("./mesh-backdrop"), { ssr: false });


/**
 * The backdrop behind the glass. Still presets and smooth gradients are pure CSS; mesh presets and flowing
 * gradients draw a slow Paper Shaders gradient over a CSS blend of the same colours, which is all that shows before
 * the shader loads or with reduced motion turned on. Photos come from the person's uploads. The preset comes from `data-wallpaper` on `<html>`.
 */
export function Wallpaper() {
  const [wallpaper] = useHtmlPreference<WallpaperName>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [gradient] = useStoredJson<CustomGradient>(GRADIENT_KEY, DEFAULT_GRADIENT);
  const [photo] = useStoredJson<PhotoBackground | null>(PHOTO_KEY, null);
  const theme = useResolvedTheme();
  const still = usePrefersReducedMotion();
  usePhotoInk(wallpaper === "photo" ? photo : null, theme);
  useEffect(() => {
    if (wallpaper === "gradient") applyGradientVars(gradient, theme);
    else clearGradientState();
    if (wallpaper === "photo" && photo) applyPhotoVars(photo);
  }, [wallpaper, gradient, photo, theme]);
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      {isMesh(wallpaper) && <MeshBackdrop key={`${wallpaper}-${theme}`} colors={MESH_PALETTES[wallpaper][theme]} still={still} />}
      {wallpaper === "gradient" && styleOf(gradient) === "flowing" && (
        <MeshBackdrop colors={shownColors(gradient, theme)} still={still || gradient.motion === 0} motion={gradient.motion} swirl={gradient.swirl} distortion={gradient.distortion} grain={gradient.grain} />
      )}
      {wallpaper === "photo" && photo && <span className={styles.photo} />}
      <span className={styles.light} />
      <span className={styles.veil} />
      <span className={styles.grain} />
    </div>
  );
}
